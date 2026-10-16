import { addCheck } from '../store.js';
import { CHECK_STATUS, CHECK_ACTION, allowedActions } from '../model.js';
import * as db from '../db.js';
import { $, esc, readForm, toast, icons, ask, options, dateTimePicker } from '../ui.js';
import { fromInputDateTime, toInputDateTime, formatDate } from '../util.js';
import { layout, meta } from './shell.js';

export async function checkFormView({ root, project, params }) {
  const p = `#/p/${project.id}`;
  const dep = await db.get('deployments', params[0]);
  if (!dep) { location.hash = `${p}/stations`; return; }
  if (dep.status !== 'active') { toast('This deployment is closed'); location.hash = `${p}/d/${dep.uid}`; return; }
  const prev = (await db.byIndex('checks', 'deploymentUid', dep.uid)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  root.innerHTML = layout({
    project, title: `Check ${dep.locationId}`, back: `${p}/d/${dep.uid}`, tab: null,
    body: `
      <div class="card">
        <h3>${esc(dep.deviceId)}</h3>
        ${meta([`Deployed ${formatDate(dep.deploymentStart, false)}`, prev[0] ? `Last check ${formatDate(prev[0].timestamp, false)}` : ''])}
      </div>
      <form id="check-form" novalidate>
        <section class="card">
          <div class="grid2">
            <div class="field"><label for="c-status">Camera status</label>
              <select id="c-status" name="status">${options(CHECK_STATUS, 'active')}</select></div>
            <div class="field"><label for="c-action">Action</label>
              <select id="c-action" name="action"></select></div>
          </div>
          <div class="hint-box" id="consequence"></div>
        </section>
        <section class="card">
          <h2>Details</h2>
          <div class="field"><label for="c-time">Date &amp; time</label>
            <input id="c-time" name="timestamp" type="text" value="${toInputDateTime(new Date())}"></div>
          <div class="grid2">
            <div class="field"><label for="c-bat">Battery (%)</label>
              <input id="c-bat" name="battery" type="number" inputmode="numeric" min="0" max="100" step="1"></div>
            <div class="field"><label for="c-img">Images on card</label>
              <input id="c-img" name="imageCount" type="number" inputmode="numeric" min="0" step="1"></div>
          </div>
          <label class="check"><input type="checkbox" name="sdSwapped"> SD card swapped / downloaded</label>
          <div class="field"><label for="c-obs">Observer</label>
            <input id="c-obs" name="observer" value="${esc(project.settings.observer)}"></div>
          <div class="field"><label for="c-notes">Notes</label>
            <textarea id="c-notes" name="notes" rows="3" placeholder="e.g. lens fogged, moved by elephant"></textarea></div>
        </section>
        <div class="sticky-actions">
          <button class="btn primary block big" type="submit">${icons.check}Save check</button>
        </div>
      </form>`,
  });

  const form = $('#check-form');
  // A check happens between the deployment start and now
  const picker = dateTimePicker(form.elements.timestamp, { min: new Date(dep.deploymentStart), max: new Date() });
  const update = () => {
    const F = form.elements;
    const status = F.status.value;
    const allowed = allowedActions(status);
    const current = allowed.includes(F.action.value) ? F.action.value : allowed[0];
    F.action.innerHTML = options(Object.fromEntries(allowed.map((a) => [a, CHECK_ACTION[a]])), current);
    F.action.disabled = allowed.length === 1;
    const action = F.action.value;
    const lastActive = prev.find((c) => c.status === 'active');
    const msg = status === 'stolen'
      ? `Deployment closes at the last confirmed working date (${formatDate(lastActive?.timestamp ?? dep.deploymentStart, false)}), <b>${esc(dep.deviceId)}</b> is marked lost`
      : action === 'remove'
        ? `Deployment closes now, <b>${esc(dep.deviceId)}</b> goes to ${status === 'damaged' ? 'maintenance' : 'available cameras'}`
        : 'Camera stays in place';
    $('#consequence').innerHTML = msg;
    $('#consequence').className = `hint-box ${status === 'stolen' || action === 'remove' ? 'warn' : ''}`;
  };
  form.addEventListener('change', update);
  update();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = readForm(form);
    f.action = form.elements.action.value; // disabled (single choice) selects are skipped by readForm
    f.timestamp = fromInputDateTime(f.timestamp);
    if (!f.timestamp) { toast('Set the check date and time', 'error'); return; }
    if (new Date(f.timestamp) > new Date(Date.now() + 60000)) { toast('The check cannot be in the future', 'error'); return; }
    if (new Date(f.timestamp) < new Date(dep.deploymentStart)) { toast('The check cannot be before the deployment', 'error'); return; }
    if (f.battery !== '' && (+f.battery < 0 || +f.battery > 100)) { toast('Battery must be 0 to 100%', 'error'); return; }
    f.battery = f.battery === '' ? null : +f.battery;
    f.imageCount = f.imageCount === '' ? null : +f.imageCount;
    if ((f.status === 'stolen' || f.action === 'remove') && !(await ask('This closes the deployment', { ok: 'Continue' }))) return;
    try {
      await addCheck(dep, f);
      toast(f.status === 'stolen' ? 'Camera marked lost' : f.action === 'remove' ? 'Camera removed' : 'Check saved');
      location.hash = `${p}/d/${dep.uid}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  return () => picker?.destroy();
}
