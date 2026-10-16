// Persistence-level operations: combine model rules with atomic IndexedDB writes.

import * as db from './db.js';
import { applyCheck, reopenDeployment, cameraModel, makeDeploymentId, newDevice, validateDeviceId } from './model.js';
import { isoLocal, safeId, uid } from './util.js';
import { makeBackup } from './export.js';

export const listProjects = () => db.all('projects');
export const getProject = (id) => db.get('projects', id);
export const saveProject = (p) => db.put('projects', p);

export async function projectData(projectId) {
  const [devices, locations, deployments, checks] = await Promise.all([
    db.byIndex('devices', 'projectId', projectId),
    db.byIndex('locations', 'projectId', projectId),
    db.byIndex('deployments', 'projectId', projectId),
    db.byIndex('checks', 'projectId', projectId),
  ]);
  return { devices, locations, deployments, checks };
}

export async function deleteProject(projectId) {
  const data = await projectData(projectId);
  const ops = [{ store: 'projects', delete: projectId }];
  for (const [store, key] of [['devices', 'uid'], ['locations', 'uid'], ['deployments', 'uid'], ['checks', 'uid']]) {
    for (const r of data[store]) ops.push({ store, delete: r[key] });
  }
  return db.commit(ops);
}

// ---------- devices ----------
export async function addDevice(projectId, form) {
  const devices = await db.byIndex('devices', 'projectId', projectId);
  const err = validateDeviceId(form.deviceId, devices);
  if (err) throw new Error(err);
  const d = newDevice(projectId, form);
  await db.put('devices', d);
  return d;
}

export async function updateDevice(device, form) {
  const devices = await db.byIndex('devices', 'projectId', device.projectId);
  const err = validateDeviceId(form.deviceId, devices, device.uid);
  if (err) throw new Error(err);
  const used = (await db.byIndex('deployments', 'deviceUid', device.uid)).length > 0;
  const deviceId = safeId(form.deviceId);
  if (used && deviceId !== device.deviceId) {
    throw new Error('This camera already has deployments; its ID can no longer change');
  }
  const next = {
    ...device, deviceId,
    make: (form.make ?? '').trim(), model: (form.model ?? '').trim(),
    serial: (form.serial ?? '').trim(), notes: (form.notes ?? '').trim(),
  };
  await db.put('devices', next);
  return next;
}

export async function deleteDevice(device) {
  const used = (await db.byIndex('deployments', 'deviceUid', device.uid)).length > 0;
  if (used) throw new Error('This camera has deployments and cannot be deleted');
  return db.del('devices', device.uid);
}

// ---------- deployments ----------
/**
 * form: deployment fields plus either locationUid (existing station) or
 * locationId/locationName (new station).
 */
export async function createDeployment(project, form) {
  const device = await db.get('devices', form.deviceUid);
  if (!device) throw new Error('Camera not found');
  if (device.status !== 'available') throw new Error(`Camera ${device.deviceId} is not available (${device.status})`);

  const { locations, deployments } = await projectData(project.id);
  let location = form.locationUid ? locations.find((l) => l.uid === form.locationUid) : null;
  const ops = [];
  if (!location) {
    const clash = locations.find((l) => l.locationId.toLowerCase() === form.locationId.trim().toLowerCase());
    if (clash) throw new Error(`Station ${clash.locationId} already exists, pick it from the list`);
    location = {
      uid: uid(), projectId: project.id,
      locationId: form.locationId.trim(), locationName: (form.locationName || '').trim(),
      latitude: +form.latitude, longitude: +form.longitude, createdAt: isoLocal(),
    };
    ops.push({ store: 'locations', put: location });
  } else if (deployments.some((d) => d.locationUid === location.uid && d.status === 'active')) {
    throw new Error(`Station ${location.locationId} already has an active camera`);
  }

  let deploymentId = makeDeploymentId(device.deviceId, new Date(form.deploymentStart));
  if (deployments.some((d) => d.deploymentId === deploymentId)) deploymentId += '_b';

  const dep = {
    ...form,
    uid: uid(),
    projectId: project.id,
    deploymentId,
    deviceUid: device.uid,
    deviceId: device.deviceId,
    cameraModel: cameraModel(device),
    locationUid: location.uid,
    locationId: location.locationId,
    locationName: location.locationName,
    status: 'active',
    deploymentEnd: null,
    createdAt: isoLocal(),
    updatedAt: isoLocal(),
  };
  ops.push({ store: 'deployments', put: dep });
  ops.push({ store: 'devices', put: { ...device, status: 'deployed' } });
  await db.commit(ops);
  return dep;
}

/** Edit form values; identity (ID, camera, station) stays fixed. */
export async function updateDeployment(dep, form) {
  const locked = ['uid', 'projectId', 'deploymentId', 'deviceUid', 'deviceId', 'cameraModel', 'locationUid', 'locationId', 'status', 'closedByCheck', 'endReason', 'createdAt'];
  const next = { ...dep, ...form, updatedAt: isoLocal() };
  for (const k of locked) next[k] = dep[k];
  if (dep.status === 'active') next.deploymentEnd = null;
  const ops = [{ store: 'deployments', put: next }];
  // Station name edits propagate to the station and all its deployments,
  // so one locationID never carries two names in the export.
  if (form.locationName !== undefined && form.locationName !== dep.locationName) {
    const loc = await db.get('locations', dep.locationUid);
    if (loc) ops.push({ store: 'locations', put: { ...loc, locationName: form.locationName } });
    const siblings = (await db.byIndex('deployments', 'projectId', dep.projectId))
      .filter((d) => d.locationUid === dep.locationUid && d.uid !== dep.uid);
    for (const s of siblings) ops.push({ store: 'deployments', put: { ...s, locationName: form.locationName } });
  }
  await db.commit(ops);
  return next;
}

export async function deleteDeployment(dep) {
  const checks = await db.byIndex('checks', 'deploymentUid', dep.uid);
  const ops = [{ store: 'deployments', delete: dep.uid }, ...checks.map((c) => ({ store: 'checks', delete: c.uid }))];
  if (dep.status === 'active') {
    const device = await db.get('devices', dep.deviceUid);
    if (device) ops.push({ store: 'devices', put: { ...device, status: 'available' } });
  }
  return db.commit(ops);
}

// ---------- checks ----------
export async function addCheck(dep, form) {
  const device = await db.get('devices', dep.deviceUid);
  const previousChecks = await db.byIndex('checks', 'deploymentUid', dep.uid);
  const check = {
    uid: uid(),
    projectId: dep.projectId,
    deploymentUid: dep.uid,
    deploymentId: dep.deploymentId,
    timestamp: form.timestamp || isoLocal(),
    status: form.status,
    action: form.action,
    battery: form.battery ?? null,
    sdSwapped: !!form.sdSwapped,
    imageCount: form.imageCount ?? null,
    observer: form.observer || '',
    notes: form.notes || '',
    createdAt: isoLocal(),
  };
  if (new Date(check.timestamp) < new Date(dep.deploymentStart)) {
    throw new Error('Check time is before the deployment start');
  }
  const r = applyCheck({ deployment: dep, device, check, previousChecks });
  const ops = [{ store: 'checks', put: check }, { store: 'deployments', put: r.deployment }];
  if (r.device) ops.push({ store: 'devices', put: r.device });
  await db.commit(ops);
  return { check, deployment: r.deployment };
}

/** Delete a check; if it closed the deployment, reopen it. */
export async function deleteCheck(check) {
  const dep = await db.get('deployments', check.deploymentUid);
  const ops = [{ store: 'checks', delete: check.uid }];
  if (dep && dep.closedByCheck === check.uid) {
    const device = await db.get('devices', dep.deviceUid);
    const r = reopenDeployment({ deployment: dep, device });
    ops.push({ store: 'deployments', put: r.deployment });
    if (r.device) ops.push({ store: 'devices', put: r.device });
  }
  return db.commit(ops);
}

/** Put a device in maintenance back into service, or mark it lost etc. */
export async function setDeviceStatus(device, status) {
  if (device.status === 'deployed') throw new Error('Close the deployment with a check first');
  if (status === 'deployed') throw new Error('Use Deploy to deploy a camera');
  const next = { ...device, status };
  await db.put('devices', next);
  return next;
}

// ---------- backup ----------
export async function backup(projectId) {
  const project = await getProject(projectId);
  return makeBackup(project, await projectData(projectId));
}

/** Restore a backup. Replaces the project with the same id if it exists. */
export async function restore(data) {
  const existing = await getProject(data.project.id);
  if (existing) await deleteProject(existing.id);
  const ops = [{ store: 'projects', put: data.project }];
  for (const s of ['devices', 'locations', 'deployments', 'checks']) {
    for (const r of data[s]) ops.push({ store: s, put: { ...r, projectId: data.project.id } });
  }
  await db.commit(ops);
  return data.project;
}
