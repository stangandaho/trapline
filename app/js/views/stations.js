import { projectData, deleteDeployment, deleteCheck } from '../store.js';
import { checkUrgency, trapDays, CHECK_STATUS, CHECK_ACTION, FEATURE_TYPES } from '../model.js';
import * as db from '../db.js';
import { $, $$, esc, toast, icons, ask } from '../ui.js';
import { formatDate, ago } from '../util.js';
import { layout, empty, badge, meta, statusKind } from './shell.js';

const urgency = { ok: ['On track', 'ok'], due: ['Check due', 'warn'], overdue: ['Overdue', 'bad'] };

export async function stationsView({ root, project }) {
  const { deployments, checks, devices } = await projectData(project.id);
  const interval = project.settings.checkIntervalDays;
  const checksBy = groupBy(checks, 'deploymentUid');
  const active = deployments
    .filter((d) => d.status === 'active')
    .map((d) => ({ d, u: checkUrgency(d, checksBy[d.uid] ?? [], interval) }))
    .sort((a, b) => b.u.days - a.u.days);
  const closed = deployments.filter((d) => d.status !== 'active').sort((a, b) => (b.deploymentEnd ?? '').localeCompare(a.deploymentEnd ?? ''));
  const totalDays = deployments.reduce((s, d) => s + trapDays(d), 0);
  const available = devices.filter((d) => d.status === 'available').length;
  const due = active.filter((a) => a.u.level !== 'ok').length;
  const p = `#/p/${project.id}`;

  root.innerHTML = layout({
    project, title: project.name, tab: 'stations',
    body: `
      <table class="dash">
        <thead><tr><th>Active</th><th>Cameras free</th><th>Trap-days</th><th>Checks due</th></tr></thead>
        <tbody><tr>
          <td>${active.length}</td>
          <td>${available}</td>
          <td>${Math.round(totalDays)}</td>
          <td class="${due ? 'warn' : ''}">${due}</td>
        </tr></tbody>
      </table>

      <h2 class="section-title">Active stations</h2>
      ${active.length ? `<div class="list">${active.map(({ d, u }) => `
        <div class="card">
          <a class="card-main" href="${p}/d/${d.uid}">
            <div class="card-row">
              <div>
                <h3>${esc(d.locationId)}</h3>
                ${d.locationName ? `<p class="small muted">${esc(d.locationName)}</p>` : ''}
              </div>
              ${badge(...urgency[u.level])}
            </div>
            ${meta([`<b>${esc(d.deviceId)}</b>`, `${Math.floor(trapDays(d))} trap-days`, `Visited ${ago(lastVisit(d, checksBy[d.uid]))}`])}
          </a>
          <div class="card-actions">
            <a class="btn small primary" href="${p}/d/${d.uid}/check">${icons.check}Check</a>
            <a class="btn small" href="${p}/map?goto=${d.uid}">${icons.compass}Go to</a>
          </div>
        </div>`).join('')}</div>`
        : empty('No camera deployed yet', `<a class="btn primary" href="${p}/deploy">${icons.plus}Deploy a camera</a>`)}

      ${closed.length ? `
        <details class="closed">
          <summary><h2 class="section-title inline">Closed deployments (${closed.length})</h2></summary>
          <div class="list">${closed.map((d) => `
            <a class="card link-card compact" href="${p}/d/${d.uid}">
              <div class="card-row">
                <h3>${esc(d.locationId)}</h3>
                ${badge(d.endReason ?? d.status, statusKind[d.status])}
              </div>
              ${meta([`<b>${esc(d.deviceId)}</b>`, `${formatDate(d.deploymentStart, false)} to ${formatDate(d.deploymentEnd, false)}`, `${Math.floor(trapDays(d))} trap-days`])}
            </a>`).join('')}
          </div>
        </details>` : ''}`,
  });
}

export async function deploymentView({ root, project, params, rerender }) {
  const dep = await db.get('deployments', params[0]);
  if (!dep) { location.hash = `#/p/${project.id}/stations`; return; }
  const checks = (await db.byIndex('checks', 'deploymentUid', dep.uid)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const p = `#/p/${project.id}`;
  const envDefs = Object.fromEntries(project.settings.envFields.map((f) => [f.key, f.label]));
  const row = (k, v) => (v === null || v === undefined || v === '' ? '' : `<tr><th>${k}</th><td>${v}</td></tr>`);
  const unit = (v, u) => (v === null || v === undefined || v === '' ? '' : `${esc(v)}${u === '°' ? '' : ' '}${u}`);
  const clock = dep.timestampIssues === false ? 'Checked, correct' : dep.timestampIssues === true ? 'Has issues' : 'Not checked';

  root.innerHTML = layout({
    project, title: dep.locationName ? `${dep.locationId} ${dep.locationName}` : dep.locationId, back: `${p}/stations`, tab: 'stations',
    body: `
      <div class="card">
        <div class="card-row">
          <h3>${esc(dep.deviceId)}</h3>
          ${badge(dep.status === 'active' ? 'active' : dep.endReason ?? dep.status, statusKind[dep.status])}
        </div>
        <div class="btn-row">
          ${dep.status === 'active' ? `<a class="btn primary" href="${p}/d/${dep.uid}/check">${icons.check}Check</a>` : ''}
          <a class="btn" href="${p}/map?goto=${dep.uid}">${icons.compass}Go to</a>
          <a class="btn" href="${p}/d/${dep.uid}/edit">Edit</a>
        </div>
      </div>

      <div class="card">
        <h2>Deployment</h2>
        <table class="kv">
          ${row('Camera', `${esc(dep.deviceId)} <span class="muted">${esc(dep.cameraModel)}</span>`)}
          ${row('Start', formatDate(dep.deploymentStart))}
          ${row('End', dep.deploymentEnd ? formatDate(dep.deploymentEnd) : '')}
          ${row('Trap-days', Math.floor(trapDays(dep)))}
          ${row('Coordinates', `${dep.latitude}, ${dep.longitude}`)}
          ${row('GPS accuracy', unit(dep.coordinateUncertainty, 'm'))}
          ${row('Elevation', unit(dep.altitude, 'm'))}
          ${row('Set up by', esc(dep.setupBy))}
        </table>
      </div>

      <div class="card">
        <h2>Camera setup</h2>
        <table class="kv">
          ${row('Height', unit(dep.cameraHeight, 'm'))}
          ${row('Tilt', unit(dep.cameraTilt, '°'))}
          ${row('Heading', unit(dep.cameraHeading, '°'))}
          ${row('Detection distance', unit(dep.detectionDistance, 'm'))}
          ${row('Field of view', unit(dep.cameraFov, '°'))}
          ${row('Trigger delay', unit(dep.cameraDelay, 's'))}
          ${row('Depth', unit(dep.cameraDepth, 'm'))}
          ${row('Bait', dep.baitUse ? 'Yes' : 'No')}
          ${row('Camera clock', clock)}
        </table>
      </div>

      <div class="card">
        <h2>Environment</h2>
        <table class="kv">
          ${row('Habitat', esc(dep.habitat))}
          ${dep.featureType ? row('Feature', esc(FEATURE_TYPES[dep.featureType] ?? dep.featureType)) : ''}
          ${Object.entries(dep.env ?? {}).map(([k, v]) => row(esc(envDefs[k] ?? k), esc(v))).join('')}
          ${row('Groups', esc(dep.deploymentGroups))}
          ${row('Comments', esc(dep.comments))}
        </table>
      </div>

      <div class="card">
        <h2>Checks (${checks.length})</h2>
        ${checks.length ? `<ol class="timeline">${checks.map((c, i) => `
          <li>
            <div class="card-row">
              <b>${formatDate(c.timestamp)}</b>
              <span>${badge(c.status, statusKind[c.status])} ${c.action !== 'leave' ? badge(CHECK_ACTION[c.action], 'muted') : ''}</span>
            </div>
            ${meta([
              c.battery !== '' && c.battery !== null ? `Battery ${esc(c.battery)}%` : '',
              c.sdSwapped ? 'SD swapped' : '',
              c.imageCount !== '' && c.imageCount !== null ? `${esc(c.imageCount)} images` : '',
              c.observer ? esc(c.observer) : '',
            ])}
            ${c.notes ? `<p class="small">${esc(c.notes)}</p>` : ''}
            ${i === 0 ? `<button class="link danger small" data-del-check="${c.uid}">Delete this check${dep.closedByCheck === c.uid ? ' (reopens deployment)' : ''}</button>` : ''}
          </li>`).join('')}</ol>` : '<p class="muted">No check yet</p>'}
      </div>

      <button class="btn danger outline block" id="del-dep">Delete deployment</button>`,
  });

  $$('[data-del-check]').forEach((b) => b.addEventListener('click', async () => {
    const c = checks.find((x) => x.uid === b.dataset.delCheck);
    if (!(await ask(`Delete the check of ${formatDate(c.timestamp)}?`, { ok: 'Delete', danger: true }))) return;
    try { await deleteCheck(c); toast('Check deleted'); rerender(); } catch (e) { toast(e.message, 'error'); }
  }));

  $('#del-dep').addEventListener('click', async () => {
    if (!(await ask(`Delete this deployment at ${dep.locationId}?`, { ok: 'Delete', danger: true, detail: `Its ${checks.length} check(s) are deleted too. This cannot be undone` }))) return;
    await deleteDeployment(dep);
    toast('Deployment deleted');
    location.hash = `${p}/stations`;
  });
}

function lastVisit(d, checks = []) {
  return [d.deploymentStart, ...checks.map((c) => c.timestamp)].sort((a, b) => new Date(b) - new Date(a))[0];
}

function groupBy(arr, key) {
  const out = {};
  for (const x of arr) (out[x[key]] ??= []).push(x);
  return out;
}
