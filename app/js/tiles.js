// Offline base map: a Leaflet tile layer that reads tiles from IndexedDB first,
// fetches (and caches) them when online, and a region downloader.

import * as db from './db.js';
import { hashString, tileRanges, countTiles } from './util.js';

export const PROVIDERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    // The OSM tile usage policy forbids bulk download; tiles you browse are still cached.
    bulk: false,
  },
  topo: {
    name: 'OpenTopoMap (terrain)',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
    bulk: true,
  },
  esri: {
    name: 'Esri World Imagery (satellite)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    bulk: true,
  },
  custom: { name: 'Custom tile URL', url: '', attribution: 'Custom tiles', maxZoom: 19, bulk: true },
};

export const MAX_DOWNLOAD_TILES = 20000;

export function providerFor(settings) {
  const key = settings.tileProvider in PROVIDERS ? settings.tileProvider : 'osm';
  const p = { ...PROVIDERS[key], key };
  if (key === 'custom') {
    p.url = settings.customTileUrl || '';
    p.key = `custom-${hashString(p.url)}`;
  }
  return p;
}

const tileUrl = (tpl, z, x, y) => tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', 'a');
const tileKey = (provKey, z, x, y) => `${provKey}/${z}/${x}/${y}`;

/** Leaflet layer that serves cached tiles and caches what it fetches. */
export function offlineLayer(provider) {
  const Layer = L.TileLayer.extend({
    createTile(coords, done) {
      const img = document.createElement('img');
      img.alt = '';
      img.setAttribute('role', 'presentation');
      const { z, x, y } = coords;
      const key = tileKey(provider.key, z, x, y);
      const show = (blob) => {
        const u = URL.createObjectURL(blob);
        img.onload = () => { URL.revokeObjectURL(u); done(null, img); };
        img.onerror = () => { URL.revokeObjectURL(u); done(new Error('bad tile'), img); };
        img.src = u;
      };
      db.get('tiles', key).then(async (blob) => {
        if (blob) return show(blob);
        if (!provider.url || !navigator.onLine) return done(new Error('offline'), img);
        try {
          const r = await fetch(tileUrl(provider.url, z, x, y), { mode: 'cors' });
          if (!r.ok) throw new Error(r.status);
          const b = await r.blob();
          db.put('tiles', b, key).catch(() => {});
          show(b);
        } catch {
          // CORS-less server: show without caching
          img.onload = () => done(null, img);
          img.onerror = () => done(new Error('tile failed'), img);
          img.src = tileUrl(provider.url, z, x, y);
        }
      }).catch((e) => done(e, img));
      return img;
    },
  });
  return new Layer('', { maxZoom: provider.maxZoom, maxNativeZoom: provider.maxZoom, attribution: provider.attribution, crossOrigin: true });
}

export function estimateDownload(bounds, zmin, zmax) {
  const bbox = { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() };
  return { bbox, count: countTiles(bbox, zmin, zmax) };
}

/**
 * Download every tile of bbox for zooms zmin..zmax. Skips tiles already stored.
 * Returns {promise, abort}. onProgress({done, total, failed, skipped})
 */
export function downloadRegion(provider, bbox, zmin, zmax, onProgress) {
  const ctrl = new AbortController();
  const promise = (async () => {
    if (!provider.bulk) throw new Error(`${provider.name} does not allow bulk downloads, choose another base map in settings`);
    if (!provider.url) throw new Error('No tile URL configured');
    const total = countTiles(bbox, zmin, zmax);
    if (total > MAX_DOWNLOAD_TILES) throw new Error(`Area too large (${total} tiles, max ${MAX_DOWNLOAD_TILES}), zoom in or lower the max zoom`);
    const existing = new Set(await db.tileKeys(provider.key + '/'));
    const queue = [];
    for (const r of tileRanges(bbox, zmin, zmax)) {
      for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) queue.push([r.z, x, y]);
    }
    const st = { done: 0, total, failed: 0, skipped: 0 };
    const worker = async () => {
      while (queue.length && !ctrl.signal.aborted) {
        const [z, x, y] = queue.shift();
        const key = tileKey(provider.key, z, x, y);
        if (existing.has(key)) { st.skipped++; st.done++; onProgress({ ...st }); continue; }
        try {
          const r = await fetch(tileUrl(provider.url, z, x, y), { signal: ctrl.signal, mode: 'cors' });
          if (!r.ok) throw new Error(r.status);
          await db.put('tiles', await r.blob(), key);
        } catch (e) {
          if (ctrl.signal.aborted) break;
          st.failed++;
        }
        st.done++;
        onProgress({ ...st });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (ctrl.signal.aborted) throw new Error('Download cancelled');
    return st;
  })();
  return { promise, abort: () => ctrl.abort() };
}

export async function cachedTileCount(provider) {
  return (await db.tileKeys(provider.key + '/')).length;
}

export async function clearTiles(provider) {
  return db.deleteTiles(provider.key + '/');
}
