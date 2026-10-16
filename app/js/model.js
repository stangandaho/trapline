// Domain rules for devices, deployments and checks. Pure functions: they take
// records and return new records; persistence happens in store.js.

import { isoLocal, safeId, uid } from './util.js';

export const DEVICE_STATUS = {
  available: 'Available',
  deployed: 'Deployed',
  maintenance: 'Maintenance',
  lost: 'Lost',
};

export const CHECK_STATUS = {
  active: 'Active',
  inactive: 'Inactive',
  damaged: 'Damaged',
  stolen: 'Stolen',
};

export const CHECK_ACTION = {
  leave: 'Leave',
  remove: 'Remove',
  none: 'None',
};

// Camtrap DP 1.0 deployments.featureType vocabulary
export const FEATURE_TYPES = {
  '': 'None',
  roadPaved: 'Paved road',
  roadDirt: 'Dirt road',
  trailHiking: 'Hiking trail',
  trailGame: 'Game trail',
  roadUnderpass: 'Road underpass',
  roadOverpass: 'Road overpass',
  roadBridge: 'Road bridge',
  culvert: 'Culvert',
  burrow: 'Burrow',
  nestSite: 'Nest site',
  carcass: 'Carcass',
  waterSource: 'Water source',
  fruitingTree: 'Fruiting tree',
};

export const DEFAULT_SETTINGS = {
  observer: '',
  maxAccuracy: 15, // m; warn above this when deploying
  gpsSeconds: 20,
  checkIntervalDays: 14,
  habitats: ['Gallery forest', 'Woodland savanna', 'Tree savanna', 'Shrub savanna', 'Grassland', 'Wetland', 'Cropland'],
  envFields: [], // defined by the user when creating the project
  tileProvider: 'osm',
  customTileUrl: '',
};

export function newProject(name, description = '') {
  return {
    id: uid(),
    name: name.trim(),
    description: description.trim(),
    createdAt: isoLocal(),
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

export function newDevice(projectId, f) {
  return {
    uid: uid(),
    projectId,
    deviceId: safeId(f.deviceId),
    make: (f.make ?? '').trim(),
    model: (f.model ?? '').trim(),
    serial: (f.serial ?? '').trim(),
    notes: (f.notes ?? '').trim(),
    status: 'available',
    createdAt: isoLocal(),
  };
}

/** Camtrap DP wants "manufacturer-model". */
export function cameraModel(device) {
  return [device.make, device.model].filter(Boolean).join('-');
}

/** <DEVICE ID>_YYMMDD_HHMMSS in device local time. */
export function makeDeploymentId(deviceId, date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const d = new Date(date);
  return `${safeId(deviceId)}_${p(d.getFullYear() % 100)}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Next free station code like S001, S002 … */
export function nextLocationId(locations, prefix = 'S') {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const l of locations) {
    const m = re.exec(l.locationId);
    if (m) max = Math.max(max, +m[1]);
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function validateDeviceId(deviceId, devices, selfUid = null) {
  const id = safeId(deviceId);
  if (!id) return 'Camera ID is required';
  if (devices.some((d) => d.deviceId.toLowerCase() === id.toLowerCase() && d.uid !== selfUid)) {
    return `Device ID "${id}" already exists in this project`;
  }
  return null;
}

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/** Field-level validation for a deployment form. Returns {errors:{}, warnings:{}} */
export function validateDeployment(d, settings = DEFAULT_SETTINGS) {
  const errors = {}, warnings = {};
  const lat = num(d.latitude), lon = num(d.longitude);
  if (lat === null || isNaN(lat) || lat < -90 || lat > 90) errors.latitude = 'Latitude must be between -90 and 90';
  if (lon === null || isNaN(lon) || lon < -180 || lon > 180) errors.longitude = 'Longitude must be between -180 and 180';
  if (!d.deviceUid) errors.deviceUid = 'Choose a camera';
  if (!d.locationId) errors.locationId = 'Station ID is required';
  if (!d.deploymentStart) errors.deploymentStart = 'Start date/time is required';
  const unc = num(d.coordinateUncertainty);
  if (unc !== null && (isNaN(unc) || unc < 1)) errors.coordinateUncertainty = 'Must be ≥ 1 m';
  else if (unc !== null && unc > settings.maxAccuracy) warnings.coordinateUncertainty = `GPS accuracy ${unc} m is worse than the ${settings.maxAccuracy} m target`;
  const ranges = {
    cameraHeight: [0, 100, 'Height must be 0 to 100 m'],
    cameraDepth: [0, 1000, 'Depth must be ≥ 0 m'],
    cameraTilt: [-90, 90, 'Tilt must be between -90 and 90°'],
    cameraHeading: [0, 360, 'Heading must be between 0 and 360°'],
    detectionDistance: [0, 500, 'Detection distance must be ≥ 0 m'],
    cameraDelay: [0, 86400, 'Delay must be ≥ 0 s'],
    cameraFov: [1, 360, 'Field of view must be 1 to 360°'],
  };
  for (const [k, [lo, hi, msg]] of Object.entries(ranges)) {
    const v = num(d[k]);
    if (v !== null && (isNaN(v) || v < lo || v > hi)) errors[k] = msg;
  }
  if (num(d.cameraHeight) === null) warnings.cameraHeight = 'Camera height is recommended';
  const soon = Date.now() + 5 * 60000;
  if (d.deploymentStart && new Date(d.deploymentStart) > soon) errors.deploymentStart = 'Start cannot be in the future';
  if (d.deploymentEnd && new Date(d.deploymentEnd) > soon) errors.deploymentEnd = 'End cannot be in the future';
  if (d.deploymentEnd && d.deploymentStart && new Date(d.deploymentEnd) < new Date(d.deploymentStart)) {
    errors.deploymentEnd = 'End is before start';
  }
  return { errors, warnings, ok: Object.keys(errors).length === 0 };
}

/** Which actions a check status allows. A stolen camera cannot be "removed". */
export function allowedActions(status) {
  return status === 'stolen' ? ['none'] : ['leave', 'remove'];
}

/**
 * Apply a check to a deployment and its device.
 * - leave: record only
 * - remove: deployment ends at check time; device → available (or maintenance if damaged)
 * - stolen: deployment ends at the last time the camera was confirmed active
 *   (or deployment start if never confirmed); device → lost
 */
export function applyCheck({ deployment, device, check, previousChecks = [] }) {
  if (deployment.status !== 'active') throw new Error('This deployment is already closed');
  if (!allowedActions(check.status).includes(check.action)) {
    throw new Error(`Action "${check.action}" is not allowed for status "${check.status}"`);
  }
  const dep = { ...deployment, updatedAt: isoLocal() };
  const dev = device ? { ...device } : null;

  if (check.status === 'stolen') {
    const confirmed = previousChecks
      .filter((c) => c.status === 'active' && c.timestamp <= check.timestamp)
      .map((c) => c.timestamp)
      .sort((a, b) => new Date(a) - new Date(b));
    dep.deploymentEnd = confirmed.length ? confirmed[confirmed.length - 1] : deployment.deploymentStart;
    dep.status = 'lost';
    dep.endReason = 'stolen';
    dep.closedByCheck = check.uid;
    if (dev) dev.status = 'lost';
  } else if (check.action === 'remove') {
    dep.deploymentEnd = check.timestamp;
    dep.status = 'ended';
    dep.endReason = check.status === 'active' ? 'removed' : `removed (${check.status})`;
    dep.closedByCheck = check.uid;
    if (dev) dev.status = check.status === 'damaged' ? 'maintenance' : 'available';
  }
  return { deployment: dep, device: dev };
}

/**
 * Undo the check that closed a deployment. Only possible if the camera has not
 * been deployed somewhere else in the meantime.
 */
export function reopenDeployment({ deployment, device }) {
  if (device && device.status === 'deployed') {
    throw new Error(`Camera ${device.deviceId} is deployed elsewhere; cannot reopen`);
  }
  const dep = { ...deployment, status: 'active', deploymentEnd: null, endReason: null, closedByCheck: null, updatedAt: isoLocal() };
  const dev = device ? { ...device, status: 'deployed' } : null;
  return { deployment: dep, device: dev };
}

/** Trap-days for a deployment (until end, or until `now` while active). */
export function trapDays(dep, now = new Date()) {
  const end = dep.deploymentEnd ? new Date(dep.deploymentEnd) : now;
  return Math.max(0, (end - new Date(dep.deploymentStart)) / 86400000);
}

/** 'ok' | 'due' | 'overdue' based on time since the last visit. */
export function checkUrgency(dep, checks, intervalDays = 14, now = new Date()) {
  const last = [dep.deploymentStart, ...checks.map((c) => c.timestamp)]
    .map((t) => new Date(t)).sort((a, b) => b - a)[0];
  const days = (now - last) / 86400000;
  return { days, level: days >= intervalDays * 2 ? 'overdue' : days >= intervalDays ? 'due' : 'ok' };
}

/** Stable key for deploymentTags from a variable name: "Distance to water (m)" -> "distance_to_water_m" */
export function envKey(name) {
  return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'var';
}

/**
 * Turn editor rows [{key?, name, type: 'integer'|'float'|'text', options: 'a, b'}] into
 * stored fields [{key, label, type: 'integer'|'float'|'text'|'select', options?}].
 * Existing variables keep their key, so renaming does not orphan saved values.
 * A text variable with options becomes a drop-down list.
 */
export function buildEnvFields(rows) {
  const out = [];
  const keys = new Set();
  const names = new Set();
  for (const r of rows) {
    const name = String(r.name ?? '').trim();
    const opts = String(r.options ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!name) {
      if (opts.length) throw new Error('A variable has options but no name');
      continue;
    }
    if (names.has(name.toLowerCase())) throw new Error(`Variable "${name}" is listed twice`);
    names.add(name.toLowerCase());
    let key = r.key || envKey(name);
    for (let n = 2; keys.has(key); n++) key = `${envKey(name)}_${n}`;
    keys.add(key);
    // 'number' is the older name of 'float'
    const type = r.type === 'integer' ? 'integer' : r.type === 'float' || r.type === 'number' ? 'float' : opts.length ? 'select' : 'text';
    out.push(type === 'select' ? { key, label: name, type, options: [...new Set(opts)] } : { key, label: name, type });
  }
  return out;
}
