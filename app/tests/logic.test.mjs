// Unit tests for the pure modules. Run: node --test app/tests
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDeploymentId, applyCheck, allowedActions, validateDeployment, nextLocationId, reopenDeployment, buildEnvFields, envKey, trapDays, checkUrgency, DEFAULT_SETTINGS } from '../js/model.js';
import { deploymentRow, deploymentsCSV, formatTags, DEPLOYMENT_FIELDS, parseBackup, makeBackup } from '../js/export.js';
import { haversine, bearing, averageFixes, toCSV, countTiles, isoLocal, safeId } from '../js/util.js';

test('deployment id = <DEVICE>_YYMMDD_HHMMSS', () => {
  assert.equal(makeDeploymentId('CT07', new Date(2026, 9, 16, 14, 5, 9)), 'CT07_261016_140509');
  assert.equal(makeDeploymentId('cam 1', new Date(2026, 0, 2, 3, 4, 5)), 'cam-1_260102_030405');
});

test('stolen camera cannot be removed', () => {
  assert.deepEqual(allowedActions('stolen'), ['none']);
  assert.deepEqual(allowedActions('damaged'), ['leave', 'remove']);
});

const dep = { uid: 'd1', deploymentId: 'CT01_261001_080000', status: 'active', deploymentStart: '2026-10-01T08:00:00+01:00', deploymentEnd: null };
const dev = { uid: 'v1', deviceId: 'CT01', status: 'deployed' };

test('remove ends deployment and frees the camera', () => {
  const r = applyCheck({ deployment: dep, device: dev, check: { uid: 'c1', status: 'active', action: 'remove', timestamp: '2026-10-20T09:00:00+01:00' } });
  assert.equal(r.deployment.status, 'ended');
  assert.equal(r.deployment.deploymentEnd, '2026-10-20T09:00:00+01:00');
  assert.equal(r.device.status, 'available');
});

test('damaged + remove sends camera to maintenance', () => {
  const r = applyCheck({ deployment: dep, device: dev, check: { uid: 'c1', status: 'damaged', action: 'remove', timestamp: '2026-10-20T09:00:00+01:00' } });
  assert.equal(r.device.status, 'maintenance');
  assert.equal(r.deployment.endReason, 'removed (damaged)');
});

test('stolen ends at last confirmed active check and marks camera lost', () => {
  const prev = [
    { status: 'active', timestamp: '2026-10-05T10:00:00+01:00' },
    { status: 'active', timestamp: '2026-10-10T10:00:00+01:00' },
    { status: 'inactive', timestamp: '2026-10-12T10:00:00+01:00' },
  ];
  const r = applyCheck({ deployment: dep, device: dev, previousChecks: prev, check: { uid: 'c9', status: 'stolen', action: 'none', timestamp: '2026-10-20T09:00:00+01:00' } });
  assert.equal(r.deployment.deploymentEnd, '2026-10-10T10:00:00+01:00');
  assert.equal(r.deployment.status, 'lost');
  assert.equal(r.device.status, 'lost');
  assert.throws(() => applyCheck({ deployment: dep, device: dev, check: { status: 'stolen', action: 'remove', timestamp: '2026-10-20T09:00:00+01:00' } }));
});

test('stolen without any confirmation ends at start', () => {
  const r = applyCheck({ deployment: dep, device: dev, check: { uid: 'c9', status: 'stolen', action: 'none', timestamp: '2026-10-20T09:00:00+01:00' } });
  assert.equal(r.deployment.deploymentEnd, dep.deploymentStart);
});

test('leave keeps deployment active; closed deployment rejects checks', () => {
  const r = applyCheck({ deployment: dep, device: dev, check: { uid: 'c1', status: 'inactive', action: 'leave', timestamp: '2026-10-20T09:00:00+01:00' } });
  assert.equal(r.deployment.status, 'active');
  assert.equal(r.device.status, 'deployed');
  assert.throws(() => applyCheck({ deployment: { ...dep, status: 'ended' }, device: dev, check: { status: 'active', action: 'leave' } }));
});

test('reopen refuses when the camera is deployed elsewhere', () => {
  assert.throws(() => reopenDeployment({ deployment: { ...dep, status: 'ended' }, device: { ...dev, status: 'deployed' } }));
  const r = reopenDeployment({ deployment: { ...dep, status: 'ended', deploymentEnd: 'x' }, device: { ...dev, status: 'available' } });
  assert.equal(r.deployment.deploymentEnd, null);
  assert.equal(r.device.status, 'deployed');
});

test('validation catches ranges', () => {
  const bad = validateDeployment({ latitude: 95, longitude: 2, deviceUid: 'x', locationId: 'S1', deploymentStart: 'x', cameraTilt: 120, coordinateUncertainty: 40 }, DEFAULT_SETTINGS);
  assert.ok(bad.errors.latitude);
  assert.ok(bad.errors.cameraTilt);
  assert.ok(bad.warnings.coordinateUncertainty);
  const ok = validateDeployment({ latitude: 11.5, longitude: 2.1, deviceUid: 'x', locationId: 'S1', deploymentStart: 'x', cameraHeight: 0.5 }, DEFAULT_SETTINGS);
  assert.equal(ok.ok, true);
});

test('next station id', () => {
  assert.equal(nextLocationId([]), 'S001');
  assert.equal(nextLocationId([{ locationId: 'S009' }, { locationId: 'X1' }, { locationId: 'S002' }]), 'S010');
});

test('trap days & urgency', () => {
  const d = { deploymentStart: '2026-10-01T00:00:00Z', deploymentEnd: '2026-10-11T00:00:00Z' };
  assert.equal(trapDays(d), 10);
  const u = checkUrgency({ deploymentStart: '2026-10-01T00:00:00Z' }, [], 14, new Date('2026-10-30T00:00:00Z'));
  assert.equal(u.level, 'overdue');
});

test('camtrap dp row', () => {
  const row = deploymentRow({
    deploymentId: 'CT01_261001_080000', locationId: 'S001', locationName: 'Mare', latitude: 11.1234567, longitude: 2.5,
    coordinateUncertainty: 4.2, deploymentStart: '2026-10-01T08:00:00+01:00', deploymentEnd: null, deviceId: 'CT01',
    cameraModel: 'Browning-BTC-8E', cameraHeight: 0.5, cameraTilt: -5.4, cameraHeading: 359.6, cameraFov: 55, altitude: 210,
    timestampIssues: false, baitUse: false, featureType: 'trailGame', habitat: 'Woodland savanna',
    deploymentGroups: 'grid A, season 1', env: { distWater_m: '120', canopy: 'semi|open' }, comments: 'ok', status: 'active',
  });
  assert.deepEqual(Object.keys(row), DEPLOYMENT_FIELDS);
  assert.equal(row.coordinateUncertainty, 5);
  assert.equal(row.cameraTilt, -5);
  assert.equal(row.cameraHeading, 360);
  assert.equal(row.deploymentGroups, 'grid A | season 1');
  assert.equal(row.deploymentTags, 'distWater_m:120 | canopy:semi/open | cameraFov_deg:55 | elevation_m:210 | status:active');
  assert.equal(row.timestampIssues, false);
});

test('csv quoting and onlyClosed filter', () => {
  assert.equal(toCSV([{ a: 'x,y', b: 'he said "hi"' }], ['a', 'b']), 'a,b\n"x,y","he said ""hi"""\n');
  const csv = deploymentsCSV([
    { deploymentId: 'A', deploymentStart: '2026-01-01T00:00:00Z', deploymentEnd: '2026-01-02T00:00:00Z' },
    { deploymentId: 'B', deploymentStart: '2026-01-03T00:00:00Z', deploymentEnd: null },
  ], { onlyClosed: true });
  assert.equal(csv.trim().split('\n').length, 2);
});

test('tags drop empty values', () => {
  assert.equal(formatTags({ a: 1, b: '', c: null, 'd:e': 'x' }), 'a:1 | d_e:x');
});

test('geodesy', () => {
  // 1° of latitude ≈ 111.2 km
  assert.ok(Math.abs(haversine(0, 0, 1, 0) - 111195) < 10);
  assert.equal(Math.round(bearing(0, 0, 0, 1)), 90);
  const a = averageFixes([{ lat: 10, lon: 2, accuracy: 5 }, { lat: 10.0001, lon: 2, accuracy: 20 }, { lat: 10, lon: 2, accuracy: 8 }]);
  assert.equal(a.accuracy, 8);
  assert.ok(a.lat < 10.00001);
});

test('tile count', () => {
  assert.equal(countTiles({ south: -10, west: -10, north: 10, east: 10 }, 0, 1), 1 + 4);
});

test('iso local has offset; safe id', () => {
  assert.match(isoLocal(new Date()), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.equal(safeId(' CT 01/é '), 'CT-01');
});

test('backup round trip', () => {
  const b = makeBackup({ id: 'p1', name: 'P' }, { devices: [], locations: [], deployments: [], checks: [] });
  assert.equal(parseBackup(JSON.stringify(b)).project.id, 'p1');
  assert.throws(() => parseBackup('{"format":"other"}'));
  // backups from before the rename still restore
  assert.equal(parseBackup(JSON.stringify({ ...b, format: 'cataploy-backup' })).project.id, 'p1');
});

test('environment variables from editor rows', () => {
  assert.equal(envKey('Distance to water (m)'), 'distance_to_water_m');
  assert.equal(envKey('Type de végétation'), 'type_de_vegetation');
  const f = buildEnvFields([
    { name: 'Distance to water (m)', type: 'float' },
    { name: 'Tree count', type: 'integer' },
    { name: 'Canopy', type: 'text', options: 'open, closed, open' },
    { name: 'Notes', type: 'text', options: '' },
    { name: '', type: 'text', options: '' },
    { key: 'old_key', name: 'Renamed', type: 'number' }, // legacy type -> float
  ]);
  assert.deepEqual(f.map((x) => x.type), ['float', 'integer', 'select', 'text', 'float']);
  assert.deepEqual(f[2].options, ['open', 'closed']);
  assert.equal(f[4].key, 'old_key');
  assert.throws(() => buildEnvFields([{ name: 'A' }, { name: 'a' }]), /twice/);
  assert.throws(() => buildEnvFields([{ name: '', options: 'x' }]), /no name/);
});

test('zip round trip', async () => {
  const { zipBytes, unzipStored, crc32 } = await import('../js/zip.js');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const z = zipBytes([{ name: 'deployments.csv', data: 'a,b\n' }, { name: 'trapline_backup.json', data: '{"é":1}' }]);
  const e = unzipStored(z);
  assert.deepEqual(Object.keys(e), ['deployments.csv', 'trapline_backup.json']);
  assert.equal(new TextDecoder().decode(e['trapline_backup.json']), '{"é":1}');
});

test('restore reads stored and deflated zips', async () => {
  const { zipBytes, unzip, isZip } = await import('../js/zip.js');
  const z = zipBytes([{ name: 'trapline_backup.json', data: '{"ok":1}' }]);
  assert.ok(isZip(z));
  assert.equal(isZip(new TextEncoder().encode('{"format":"trapline-backup"}')), false);
  assert.equal(new TextDecoder().decode((await unzip(z))['trapline_backup.json']), '{"ok":1}');
});

test('French translation of UI text', async () => {
  const { tr, setLang } = await import('../js/i18n.js');
  setLang('fr');
  assert.equal(tr('New project'), 'Nouveau projet');
  assert.equal(tr('Closed deployments (2)'), 'Déploiements clôturés (2)');
  assert.equal(tr('12 fixes, accuracy ±8 m'), '12 points, précision ±8 m');
  assert.equal(tr('231° WSW, you are there'), '231° OSO, vous y êtes');
  assert.equal(tr('Last backup: never'), 'Dernière sauvegarde : jamais');
  assert.equal(tr('CT04 to CT13'), 'CT04 à CT13');
  assert.equal(tr('Distance to water (m)'), 'Distance to water (m)'); // user labels untouched
  setLang('en');
  assert.equal(tr('New project'), 'New project');
});
