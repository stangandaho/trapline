// Build Camtrap DP 1.0 compatible deployments.csv plus companion tables and a
// full JSON backup. Pure functions.

import { toCSV, isoLocal } from './util.js';

// Field order of the Camtrap DP 1.0 deployments table schema
export const DEPLOYMENT_FIELDS = [
  'deploymentID', 'locationID', 'locationName', 'latitude', 'longitude',
  'coordinateUncertainty', 'deploymentStart', 'deploymentEnd', 'setupBy',
  'cameraID', 'cameraModel', 'cameraDelay', 'cameraHeight', 'cameraDepth',
  'cameraTilt', 'cameraHeading', 'detectionDistance', 'timestampIssues',
  'baitUse', 'featureType', 'habitat', 'deploymentGroups', 'deploymentTags',
  'deploymentComments',
];

export const CHECK_FIELDS = [
  'checkID', 'deploymentID', 'cameraID', 'timestamp', 'status', 'action',
  'batteryPercent', 'sdCardSwapped', 'imageCount', 'observer', 'notes',
];

export const DEVICE_FIELDS = ['cameraID', 'make', 'model', 'cameraModel', 'serialNumber', 'status', 'notes'];

const clean = (v) => String(v).replace(/[|]/g, '/').replace(/[\r\n]+/g, ' ').trim();
const n = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

/** "key:value | key:value" as recommended by Camtrap DP for deploymentTags. */
export function formatTags(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${clean(k).replace(/:/g, '_')}:${clean(v)}`)
    .join(' | ');
}

export function deploymentRow(d) {
  const tags = {
    ...(d.env ?? {}),
    cameraFov_deg: n(d.cameraFov),
    elevation_m: n(d.altitude),
    status: d.status === 'active' ? 'active' : null,
    endReason: d.endReason,
  };
  const comments = [d.comments, d.endReason ? `Ended: ${d.endReason}` : null].filter(Boolean).map(clean).join('. ');
  return {
    deploymentID: d.deploymentId,
    locationID: d.locationId,
    locationName: d.locationName || null,
    latitude: n(d.latitude),
    longitude: n(d.longitude),
    coordinateUncertainty: n(d.coordinateUncertainty) === null ? null : Math.max(1, Math.ceil(n(d.coordinateUncertainty))),
    deploymentStart: d.deploymentStart,
    deploymentEnd: d.deploymentEnd || null,
    setupBy: d.setupBy || null,
    cameraID: d.deviceId,
    cameraModel: d.cameraModel || null,
    cameraDelay: n(d.cameraDelay) === null ? null : Math.round(n(d.cameraDelay)),
    cameraHeight: n(d.cameraHeight),
    cameraDepth: n(d.cameraDepth),
    cameraTilt: n(d.cameraTilt) === null ? null : Math.round(n(d.cameraTilt)),
    cameraHeading: n(d.cameraHeading) === null ? null : Math.round(n(d.cameraHeading)),
    detectionDistance: n(d.detectionDistance),
    timestampIssues: d.timestampIssues === true || d.timestampIssues === false ? d.timestampIssues : null,
    baitUse: !!d.baitUse,
    featureType: d.featureType || null,
    habitat: d.habitat || null,
    deploymentGroups: (d.deploymentGroups || '').split(/[|,;]/).map((s) => s.trim()).filter(Boolean).join(' | ') || null,
    deploymentTags: formatTags(tags) || null,
    deploymentComments: comments || null,
  };
}

/** opts.onlyClosed drops active deployments (deploymentEnd is required by Camtrap DP). */
export function deploymentsCSV(deployments, { onlyClosed = false } = {}) {
  const rows = deployments
    .filter((d) => !onlyClosed || d.deploymentEnd)
    .sort((a, b) => a.deploymentStart.localeCompare(b.deploymentStart))
    .map(deploymentRow);
  return toCSV(rows, DEPLOYMENT_FIELDS);
}

export function checksCSV(checks, deployments) {
  const byUid = Object.fromEntries(deployments.map((d) => [d.uid, d]));
  const rows = checks
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((c) => ({
      checkID: c.uid,
      deploymentID: byUid[c.deploymentUid]?.deploymentId ?? c.deploymentId,
      cameraID: byUid[c.deploymentUid]?.deviceId ?? null,
      timestamp: c.timestamp,
      status: c.status,
      action: c.action,
      batteryPercent: n(c.battery),
      sdCardSwapped: !!c.sdSwapped,
      imageCount: n(c.imageCount),
      observer: c.observer || null,
      notes: c.notes || null,
    }));
  return toCSV(rows, CHECK_FIELDS);
}

export function devicesCSV(devices) {
  const rows = devices.map((d) => ({
    cameraID: d.deviceId,
    make: d.make,
    model: d.model,
    cameraModel: [d.make, d.model].filter(Boolean).join('-'),
    serialNumber: d.serial || null,
    status: d.status,
    notes: d.notes || null,
  }));
  return toCSV(rows, DEVICE_FIELDS);
}

/** Problems that would make the deployments table fail Camtrap DP validation. */
export function exportIssues(deployments) {
  const issues = [];
  for (const d of deployments) {
    if (!d.deploymentEnd) issues.push(`${d.locationId} ${d.deviceId} still active`);
    if (!d.coordinateUncertainty) issues.push(`${d.locationId} ${d.deviceId} has no GPS accuracy`);
    if (!d.cameraModel) issues.push(`${d.locationId} ${d.deviceId} has no camera model`);
  }
  return issues;
}

export const BACKUP_FORMAT = 'trapline-backup';
// Backups made before the rename are still accepted
const OLD_FORMATS = ['cataploy-backup'];
export const BACKUP_VERSION = 1;

export function makeBackup(project, { devices, locations, deployments, checks }) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: isoLocal(),
    project,
    devices,
    locations,
    deployments,
    checks,
  };
}

export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Not a valid JSON file'); }
  if (data?.format !== BACKUP_FORMAT && !OLD_FORMATS.includes(data?.format)) throw new Error('Not a Trapline backup file');
  if (data.version > BACKUP_VERSION) throw new Error('Backup was made by a newer version of Trapline');
  for (const k of ['devices', 'locations', 'deployments', 'checks']) {
    if (!Array.isArray(data[k])) throw new Error(`Backup is missing "${k}"`);
  }
  if (!data.project?.id) throw new Error('Backup is missing the project');
  return data;
}

export function fileStamp(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
