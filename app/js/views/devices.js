import { projectData, addDevice, updateDevice, deleteDevice, setDeviceStatus } from '../store.js';
import { DEVICE_STATUS, validateDeviceId, cameraModel } from '../model.js';
import * as db from '../db.js';
import { $, $$, esc, readForm, toast, icons, showFieldMessages, ask } from '../ui.js';
import { formatDate, safeId } from '../util.js';
import { layout, empty, badge, meta, statusKind } from './shell.js';

export async function devicesView({ root, project, query }) {
  const { devices, deployments } = await projectData(project.id);
  const filter = query.status ?? 'all';
  const counts = Object.fromEntries(Object.keys(DEVICE_STATUS).map((s) => [s, devices.filter((d) => d.status === s).length]));
  const shown = devices
    .filter((d) => filter === 'all' || d.status === filter)
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId, undefined, { numeric: true }));
  const p = `#/p/${project.id}`;
  const chip = (key, label, n) => `<a class="chip filter ${filter === key ? 'on' : ''}" href="${p}/devices${key === 'all' ? '' : `?status=${key}`}">${label} <b>${n}</b></a>`;

  root.innerHTML = layout({
    project, title: 'Cameras', tab: 'devices',
    body: `
      <div class="chips scroll">
        ${chip('all', 'All', devices.length)}
        ${Object.entries(DEVICE_STATUS).map(([k, l]) => chip(k, l, counts[k])).join('')}
      </div>
      ${devices.length === 0 ? empty('No camera registered yet', `
        <div class="btn-col">
          <a class="btn primary" href="${p}/devices/bulk">${icons.plus}Add cameras</a>
        </div>`) : ''}
      <div class="list">
        ${shown.map((d) => `
          <a class="card link-card compact" href="${p}/devices/${d.uid}">
            <div class="card-row">
              <div>
                <div class="title-row"><h3>${esc(d.deviceId)}</h3>${badge(DEVICE_STATUS[d.status], statusKind[d.status])}</div>
                ${meta([esc(cameraModel(d) || 'No model'), d.serial ? `SN ${esc(d.serial)}` : ''])}
              </div>
              <span class="chev">›</span>
            </div>
          </a>`).join('')}
      </div>
      ${devices.length ? `<a class="btn outline block" href="${p}/devices/bulk">${icons.plus}Add cameras</a>` : ''}`,
  });
}

function deviceFields(d = {}) {
  return `
    <div class="field"><label for="f-id">Camera ID</label>
      <input id="f-id" name="deviceId" required value="${esc(d.deviceId)}" placeholder="e.g. CT07" autocapitalize="characters" autocomplete="off">
      </div>
    <div class="grid2">
      <div class="field"><label for="f-make">Make</label>
        <input id="f-make" name="make" value="${esc(d.make)}" placeholder="e.g. Browning" list="makes"></div>
      <div class="field"><label for="f-model">Model</label>
        <input id="f-model" name="model" value="${esc(d.model)}" placeholder="e.g. BTC-8E"></div>
    </div>
    <datalist id="makes">${['Bushnell', 'Browning', 'Reconyx', 'Spypoint', 'Cuddeback', 'Stealth Cam', 'Moultrie', 'Wildgame', 'Snapshot Wisent', 'Victure', 'Campark', 'Uovision', 'Ltl Acorn', 'Boly', 'Hikmicro'].map((m) => `<option value="${m}">`).join('')}</datalist>
    <div class="field"><label for="f-serial">Serial number <span class="opt">optional</span></label>
      <input id="f-serial" name="serial" value="${esc(d.serial)}"></div>
    <div class="field"><label for="f-notes">Notes <span class="opt">optional</span></label>
      <textarea id="f-notes" name="notes" rows="2">${esc(d.notes)}</textarea></div>`;
}

export async function deviceFormView({ root, project, params, rerender }) {
  const p = `#/p/${project.id}`;
  const device = params[0] ? await db.get('devices', params[0]) : null;
  if (params[0] && !device) { location.hash = `${p}/devices`; return; }
  const history = device ? (await db.byIndex('deployments', 'deviceUid', device.uid)).sort((a, b) => b.deploymentStart.localeCompare(a.deploymentStart)) : [];

  const statusActions = device ? {
    available: [['lost', 'Mark as lost'], ['maintenance', 'Send to maintenance']],
    maintenance: [['available', 'Back in service'], ['lost', 'Mark as lost']],
    lost: [['available', 'Make available']],
    deployed: [],
  }[device.status] : [];

  root.innerHTML = layout({
    project, title: device ? device.deviceId : 'New camera', back: `${p}/devices`, tab: 'devices',
    body: `
      ${device ? `<div class="card"><div class="card-row"><span>Status</span>${badge(DEVICE_STATUS[device.status], statusKind[device.status])}</div>
        ${statusActions.length ? `<div class="btn-row">${statusActions.map(([s, l]) => `<button class="btn small" data-status="${s}">${l}</button>`).join('')}</div>` : ''}
      </div>` : ''}
      <form class="card" id="dev-form" novalidate>
        ${deviceFields(device ?? {})}
        <button class="btn primary block" type="submit">${device ? 'Save' : 'Add camera'}</button>
        ${device ? '' : '<button class="btn block" type="submit" data-again="1">Add and enter another</button>'}
      </form>
      ${history.length ? `<div class="card"><h2>Deployment history</h2><ul class="plain">${history.map((d) => `
        <li><a href="${p}/d/${d.uid}"><b>${esc(d.locationId)}</b></a>
        ${meta([`${formatDate(d.deploymentStart, false)} to ${d.deploymentEnd ? formatDate(d.deploymentEnd, false) : 'now'}`])}</li>`).join('')}</ul></div>` : ''}
      ${device && !history.length ? '<button class="btn danger outline block" id="del-dev">Delete camera</button>' : ''}`,
  });

  const form = $('#dev-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = readForm(form);
    try {
      if (device) {
        await updateDevice(device, f);
        toast('Saved');
        location.hash = `${p}/devices`;
      } else {
        const d = await addDevice(project.id, f);
        toast(`Camera ${d.deviceId} added`);
        if (e.submitter?.dataset.again) {
          form.reset();
          // Keep make/model to speed up entering a batch of identical cameras
          form.elements.make.value = f.make; form.elements.model.value = f.model;
          form.elements.deviceId.value = bumpId(d.deviceId);
          form.elements.deviceId.focus();
        } else {
          location.hash = `${p}/devices`;
        }
      }
    } catch (err) {
      showFieldMessages(form, { errors: { deviceId: err.message } });
    }
  });

  $$('[data-status]').forEach((b) => b.addEventListener('click', async () => {
    try { await setDeviceStatus(device, b.dataset.status); toast('Status updated'); rerender(); } catch (e) { toast(e.message, 'error'); }
  }));
  $('#del-dev')?.addEventListener('click', async () => {
    if (!(await ask(`Delete camera ${device.deviceId}?`, { ok: 'Delete', danger: true }))) return;
    try { await deleteDevice(device); toast('Camera deleted'); location.hash = `${p}/devices`; } catch (e) { toast(e.message, 'error'); }
  });
}

/** CT07 → CT08, CAM-9 → CAM-10 (keeps zero padding). */
function bumpId(id) {
  const m = /^(.*?)(\d+)$/.exec(id);
  if (!m) return id;
  return m[1] + String(+m[2] + 1).padStart(m[2].length, '0');
}

export async function bulkDevicesView({ root, project }) {
  const p = `#/p/${project.id}`;
  const existing = (await projectData(project.id)).devices;
  root.innerHTML = layout({
    project, title: 'Add cameras', back: `${p}/devices`, tab: 'devices',
    body: `
      <form class="card" id="bulk" novalidate>
        <div class="grid3">
          <div class="field"><label for="b-prefix">Prefix</label><input id="b-prefix" name="prefix" value="CT" autocapitalize="characters" autocomplete="off"></div>
          <div class="field"><label for="b-n">Number</label><input id="b-n" name="count" type="number" inputmode="numeric" value="10" min="1" max="200"></div>
          <div class="field"><label for="b-pad">Digits</label><input id="b-pad" name="pad" type="number" inputmode="numeric" value="2" min="1" max="5"></div>
        </div>
        <div class="grid2">
          <div class="field"><label for="b-make">Make</label><input id="b-make" name="make" list="makes2" autocomplete="off"></div>
          <div class="field"><label for="b-model">Model</label><input id="b-model" name="model" autocomplete="off"></div>
        </div>
        <datalist id="makes2">${['Bushnell', 'Browning', 'Reconyx', 'Spypoint', 'Cuddeback', 'Stealth Cam', 'Moultrie'].map((m) => `<option value="${m}">`).join('')}</datalist>
        <p class="small muted" id="preview"></p>
        <button class="btn primary block" type="submit">Create cameras</button>
      </form>`,
  });
  const form = $('#bulk');

  // Numbering starts at 1, or right after the highest existing camera with this prefix
  const ids = () => {
    const f = readForm(form);
    const count = parseInt(f.count, 10), pad = parseInt(f.pad, 10) || 1;
    const prefix = safeId(f.prefix);
    if (isNaN(count) || count < 1 || count > 200) return [];
    const re = new RegExp('^' + prefix.replace(/\./g, '\\.') + '(\\d+)$', 'i');
    const start = existing.reduce((m, d) => { const x = re.exec(d.deviceId); return x ? Math.max(m, +x[1]) : m; }, 0) + 1;
    return Array.from({ length: count }, (_, i) => prefix + String(start + i).padStart(pad, '0'))
      .filter((id) => !validateDeviceId(id, existing));
  };
  const preview = () => {
    const l = ids();
    $('#preview').textContent = l.length ? (l.length === 1 ? l[0] : `${l[0]} to ${l[l.length - 1]}`) : 'Number must be 1 to 200';
  };
  form.addEventListener('input', preview);
  preview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = readForm(form);
    const list = ids();
    if (!list.length) { toast('Number must be 1 to 200', 'error'); return; }
    try {
      for (const id of list) await addDevice(project.id, { deviceId: id, make: f.make, model: f.model });
      toast(`${list.length} cameras added`);
      location.hash = `${p}/devices`;
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
