import { locale } from './i18n.js';

// Pure helpers: ids, dates, geodesy, CSV, tile math. No DOM access here so the
// module can be unit-tested under Node.

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** ISO 8601 in local time with explicit UTC offset, e.g. 2026-10-16T14:25:30+01:00 */
export function isoLocal(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Value for <input type="datetime-local" step="1"> from an ISO string or Date. */
export function toInputDateTime(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Parse a datetime-local value (interpreted as device local time) to ISO with offset. */
export function fromInputDateTime(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : isoLocal(d);
}

/** Display date like "16 Oct 2026" or "16 Oct 2026, 14:05". */
export function formatDate(iso, withTime = true) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const s = d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  return withTime ? `${s}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : s;
}

/** "today", "yesterday", "5 days ago" */
export function ago(iso, now = new Date()) {
  const days = Math.floor((now - new Date(iso)) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export function daysBetween(a, b = new Date()) {
  const ms = new Date(b) - new Date(a);
  return ms / 86400000;
}

/** Camera IDs end up in deployment IDs and file names: keep them filesystem-safe. */
export function safeId(s) {
  return String(s ?? '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '');
}

// ---------- geodesy ----------
const R_EARTH = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function haversine(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) -
    Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function cardinal(b) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(b / 22.5) % 16];
}

export function formatDistance(m) {
  if (m == null || isNaN(m)) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
}

export function pathLength(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return d;
}

/**
 * Combine GPS fixes into one position. Each fix is weighted by 1/accuracy²; the
 * reported uncertainty is the median accuracy (fix errors are correlated, so the
 * formal weighted error would be overly optimistic).
 */
export function averageFixes(fixes) {
  const good = fixes.filter((f) => f && isFinite(f.lat) && isFinite(f.lon) && f.accuracy > 0);
  if (!good.length) return null;
  let sw = 0, slat = 0, slon = 0, salt = 0, nalt = 0;
  for (const f of good) {
    const w = 1 / (f.accuracy * f.accuracy);
    sw += w; slat += w * f.lat; slon += w * f.lon;
    if (f.altitude != null && isFinite(f.altitude)) { salt += f.altitude; nalt++; }
  }
  const acc = good.map((f) => f.accuracy).sort((a, b) => a - b);
  const mid = Math.floor(acc.length / 2);
  const median = acc.length % 2 ? acc[mid] : (acc[mid - 1] + acc[mid]) / 2;
  return {
    lat: +(slat / sw).toFixed(6),
    lon: +(slon / sw).toFixed(6),
    accuracy: Math.max(1, Math.ceil(median)),
    altitude: nalt ? Math.round(salt / nalt) : null,
    n: good.length,
  };
}

// ---------- CSV ----------
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? String(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows, columns) {
  const lines = [columns.map(csvCell).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  return lines.join('\n') + '\n';
}

// ---------- slippy-map tiles ----------
export function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
export function lat2tile(lat, z) {
  const r = rad(Math.max(-85.0511, Math.min(85.0511, lat)));
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** Tile ranges covering a bbox {south, west, north, east} for zooms zmin..zmax. */
export function tileRanges(bbox, zmin, zmax) {
  const out = [];
  for (let z = zmin; z <= zmax; z++) {
    const max = 2 ** z - 1;
    const x0 = Math.max(0, lon2tile(bbox.west, z)), x1 = Math.min(max, lon2tile(bbox.east, z));
    const y0 = Math.max(0, lat2tile(bbox.north, z)), y1 = Math.min(max, lat2tile(bbox.south, z));
    out.push({ z, x0, x1, y0, y1, count: (x1 - x0 + 1) * (y1 - y0 + 1) });
  }
  return out;
}

export function countTiles(bbox, zmin, zmax) {
  return tileRanges(bbox, zmin, zmax).reduce((s, r) => s + r.count, 0);
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
