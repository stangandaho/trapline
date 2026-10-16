import { projectData, createDeployment, updateDeployment } from '../store.js';
import { nextLocationId, validateDeployment, cameraModel } from '../model.js';
import * as db from '../db.js';
import { $, $$, esc, readForm, toast, icons, options, showFieldMessages, ask, dateTimePicker } from '../ui.js';
import { fromInputDateTime, toInputDateTime, haversine, formatDistance, isoLocal } from '../util.js';
import { sampleGps, startCompass, gpsAvailable } from '../sensors.js';
import { layout, empty } from './shell.js';

const NUM_FIELDS = ['latitude', 'longitude', 'coordinateUncertainty', 'altitude', 'cameraHeight', 'cameraTilt',
  'cameraHeading', 'detectionDistance', 'cameraFov', 'cameraDelay', 'cameraDepth'];

export async function deployFormView({ root, project, params }) {
  const p = `#/p/${project.id}`;
  const s = project.settings;
  const editing = params[0] ? await db.get('deployments', params[0]) : null;
  if (params[0] && !editing) { location.hash = `${p}/stations`; return; }
  const { devices, locations, deployments } = await projectData(project.id);
  const available = devices.filter((d) => d.status === 'available')
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId, undefined, { numeric: true }));
  const busyLocations = new Set(deployments.filter((d) => d.status === 'active').map((d) => d.locationUid));
  const freeLocations = locations.filter((l) => !busyLocations.has(l.uid));
  const last = deployments.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!editing && !available.length) {
    root.innerHTML = layout({
      project, title: 'Deploy', tab: null, back: `${p}/stations`,
      body: empty(devices.length ? 'All cameras are deployed, in maintenance or lost' : 'Register your cameras first',
        `<a class="btn primary" href="${p}/devices${devices.length ? '' : '/bulk'}">${devices.length ? 'See cameras' : `${icons.plus}Add cameras`}</a>`),
    });
    return;
  }

  const d = editing ?? {
    deploymentStart: isoLocal(),
    setupBy: s.observer,
    baitUse: false,
    env: {},
  };
  const env = d.env ?? {};
  const clock = d.timestampIssues === false ? 'ok' : '';
  const v = (k) => esc(d[k] ?? '');

  const envField = (f) => {
    const name = `env_${f.key}`;
    const val = env[f.key] ?? '';
    if (f.type === 'select') {
      return `<div class="field"><label for="${name}">${esc(f.label)}</label>
        <select id="${name}" name="${name}">${options(f.options, val, { placeholder: 'Select' })}</select></div>`;
    }
    return `<div class="field"><label for="${name}">${esc(f.label)}</label>
      <input id="${name}" name="${name}" ${f.type === 'integer' ? 'type="number" inputmode="numeric" step="1"' : f.type === 'float' || f.type === 'number' ? 'type="number" inputmode="decimal" step="any"' : ''} value="${esc(val)}"></div>`;
  };

  root.innerHTML = layout({
    project, title: editing ? `Edit ${editing.locationId}` : 'New deployment', tab: null,
    back: editing ? `${p}/d/${editing.uid}` : `${p}/stations`,
    body: `
    <form id="dep-form" novalidate>
      <section class="card">
        <h2>Position</h2>
        <div class="gps-panel" id="gps-panel">
          <button type="button" class="btn primary block" id="gps-btn">${icons.gps}${editing ? 'Re-take GPS position' : 'Get GPS position'}</button>
          <div class="gps-status" id="gps-status" hidden>
            <div class="progress"><div id="gps-bar"></div></div>
            <div class="small"><span id="gps-text">Waiting for satellites</span></div>
          </div>
        </div>
        <div class="grid2">
          <div class="field"><label for="f-lat">Latitude</label>
            <input id="f-lat" name="latitude" type="number" inputmode="decimal" step="any" value="${v('latitude')}"></div>
          <div class="field"><label for="f-lon">Longitude</label>
            <input id="f-lon" name="longitude" type="number" inputmode="decimal" step="any" value="${v('longitude')}"></div>
        </div>
        <div class="grid2">
          <div class="field"><label for="f-unc">Accuracy (m)</label>
            <input id="f-unc" name="coordinateUncertainty" type="number" inputmode="numeric" min="1" step="1" value="${v('coordinateUncertainty')}"></div>
          <div class="field"><label for="f-alt">Elevation (m)</label>
            <input id="f-alt" name="altitude" type="number" inputmode="numeric" step="any" value="${v('altitude')}"></div>
        </div>
      </section>

      <section class="card">
        <h2>Station and camera</h2>
        ${editing ? `
          <div class="meta big"><span><b>${esc(editing.locationId)}</b></span><span><b>${esc(editing.deviceId)}</b></span><span>${esc(editing.cameraModel)}</span></div>
          <div class="field"><label for="f-lname">Station name</label>
            <input id="f-lname" name="locationName" value="${v('locationName')}"></div>`
        : `
          <div class="segmented" role="radiogroup">
            <label><input type="radio" name="stationMode" value="new" checked><span>New station</span></label>
            <label><input type="radio" name="stationMode" value="existing" ${freeLocations.length ? '' : 'disabled'}><span>Existing station (${freeLocations.length})</span></label>
          </div>
          <div id="station-new">
            <div class="grid2">
              <div class="field"><label for="f-lid">Station ID</label>
                <input id="f-lid" name="locationId" value="${esc(nextLocationId(locations))}" autocapitalize="characters"></div>
              <div class="field"><label for="f-lname">Name <span class="opt">optional</span></label>
                <input id="f-lname" name="locationName" placeholder="e.g. Mare Bali"></div>
            </div>
          </div>
          <div id="station-existing" hidden>
            <div class="field"><label for="f-luid">Station</label>
              <select id="f-luid" name="locationUid"></select></div>
          </div>
          <div class="hint-box" id="near-hint" hidden></div>
          <div class="field"><label for="f-dev">Camera</label>
            <select id="f-dev" name="deviceUid" required>${options(Object.fromEntries(available.map((x) => [x.uid, `${x.deviceId}${cameraModel(x) ? ` (${cameraModel(x)})` : ''}`])), '', { placeholder: 'Choose an available camera' })}</select></div>`}
        <div class="field"><label for="f-start">Start date &amp; time</label>
          <input id="f-start" name="deploymentStart" type="text" value="${toInputDateTime(d.deploymentStart)}"></div>
        ${editing && editing.status !== 'active' ? `
          <div class="field"><label for="f-end">End date &amp; time</label>
            <input id="f-end" name="deploymentEnd" type="text" value="${toInputDateTime(d.deploymentEnd)}"></div>` : ''}
        <div class="field"><label for="f-by">Set up by</label>
          <input id="f-by" name="setupBy" value="${v('setupBy')}" autocomplete="name"></div>
      </section>

      <section class="card">
        <div class="card-row"><h2>Camera setup</h2>
          ${!editing && last ? '<button type="button" class="btn small ghost" id="copy-last">Copy last setup</button>' : ''}</div>
        <div class="grid2">
          <div class="field"><label for="f-h">Height (m)</label>
            <input id="f-h" name="cameraHeight" type="number" inputmode="decimal" step="0.01" min="0" value="${v('cameraHeight')}" placeholder="0.5"></div>
          <div class="field"><label for="f-tilt">Tilt (°)</label>
            <input id="f-tilt" name="cameraTilt" type="number" inputmode="numeric" step="1" min="-90" max="90" value="${v('cameraTilt')}" placeholder="0 = horizontal"></div>
        </div>
        <div class="field"><label for="f-head">Heading (°)</label>
          <div class="input-btn">
            <input id="f-head" name="cameraHeading" type="number" inputmode="numeric" step="1" min="0" max="360" value="${v('cameraHeading')}" placeholder="direction the lens faces">
            <button type="button" class="btn" id="compass-btn">${icons.compass}<span>Compass</span></button>
          </div></div>
        <div class="grid2">
          <div class="field"><label for="f-det">Detection range (m)</label>
            <input id="f-det" name="detectionDistance" type="number" inputmode="decimal" step="0.1" min="0" value="${v('detectionDistance')}"></div>
          <div class="field"><label for="f-fov">Field of view (°)</label>
            <input id="f-fov" name="cameraFov" type="number" inputmode="numeric" step="1" min="1" max="360" value="${v('cameraFov')}"></div>
        </div>
        <div class="field"><label for="f-clock">Camera date/time</label>
          <select id="f-clock" name="clock">${options({ '': 'Not checked', ok: 'Checked' }, clock)}</select></div>
        <label class="check"><input type="checkbox" name="baitUse" ${d.baitUse ? 'checked' : ''}> Bait or lure used</label>
        <details class="advanced">
          <summary>More settings</summary>
          <div class="grid2">
            <div class="field"><label for="f-delay">Trigger delay (s)</label>
              <input id="f-delay" name="cameraDelay" type="number" inputmode="numeric" min="0" step="1" value="${v('cameraDelay')}"></div>
            <div class="field"><label for="f-depth">Depth (m)</label>
              <input id="f-depth" name="cameraDepth" type="number" inputmode="decimal" min="0" step="0.1" value="${v('cameraDepth')}"></div>
          </div>
        </details>
      </section>

      <section class="card">
        <h2>Environment</h2>
        ${s.envFields.length ? s.envFields.map(envField).join('') : `<p class="small muted env-empty">No environmental variable yet, <a href="${p}/more">add them in settings</a></p>`}
        <div class="field"><label for="f-com">Comments</label>
          <textarea id="f-com" name="comments" rows="3">${v('comments')}</textarea></div>
      </section>

      <div class="sticky-actions">
        <button class="btn primary block big" type="submit">${icons.check}${editing ? 'Save changes' : 'Finish deployment'}</button>
      </div>
    </form>`,
  });

  const form = $('#dep-form');
  const F = form.elements;
  const pickers = [dateTimePicker(F.deploymentStart, { max: new Date() })];
  if (F.deploymentEnd) pickers.push(dateTimePicker(F.deploymentEnd, { min: new Date(d.deploymentStart), max: new Date() }));
  let gps = null, stopCompass = null, manualPosition = false;

  // ----- station mode -----
  const refreshStations = () => {
    if (editing) return;
    const lat = parseFloat(F.latitude.value), lon = parseFloat(F.longitude.value);
    const withDist = freeLocations.map((l) => ({ l, dist: isFinite(lat) && isFinite(lon) ? haversine(lat, lon, l.latitude, l.longitude) : null }))
      .sort((a, b) => (a.dist ?? 1e12) - (b.dist ?? 1e12) || a.l.locationId.localeCompare(b.l.locationId));
    const sel = F.locationUid.value;
    F.locationUid.innerHTML = options(Object.fromEntries(withDist.map(({ l, dist }) =>
      [l.uid, `${l.locationId}${l.locationName ? ' ' + l.locationName : ''}${dist !== null ? ` (${formatDistance(dist)})` : ''}`])), sel);
    const near = withDist[0];
    const hint = $('#near-hint');
    if (near && near.dist !== null && near.dist < 50 && form.querySelector('[name=stationMode]:checked').value === 'new') {
      hint.hidden = false;
      hint.innerHTML = `You are ${formatDistance(near.dist)} from free station <b>${esc(near.l.locationId)}</b> <button type="button" class="link" id="use-near">Use it</button>`;
      $('#use-near').onclick = () => {
        form.querySelector('[name=stationMode][value=existing]').checked = true;
        F.locationUid.value = near.l.uid;
        setMode();
      };
    } else hint.hidden = true;
  };
  const setMode = () => {
    if (editing) return;
    const mode = form.querySelector('[name=stationMode]:checked').value;
    $('#station-new').hidden = mode !== 'new';
    $('#station-existing').hidden = mode !== 'existing';
    $$('#station-new input').forEach((i) => (i.disabled = mode !== 'new'));
    F.locationUid.disabled = mode !== 'existing';
    refreshStations();
  };
  if (!editing) {
    $$('[name=stationMode]').forEach((r) => r.addEventListener('change', setMode));
    setMode();
    F.locationUid.addEventListener('change', () => {
      // No GPS yet: fall back to the station's stored coordinates
      const l = freeLocations.find((x) => x.uid === F.locationUid.value);
      if (l && !F.latitude.value && !F.longitude.value) { F.latitude.value = l.latitude; F.longitude.value = l.longitude; }
    });
    F.latitude.addEventListener('change', refreshStations);
    F.longitude.addEventListener('change', refreshStations);
  }

  // ----- GPS -----
  const startGps = () => {
    if (!gpsAvailable()) { toast('GPS not available, enter coordinates manually', 'error'); return; }
    gps?.stop();
    $('#gps-status').hidden = false;
    $('#gps-btn').disabled = true;
    const secs = s.gpsSeconds;
    manualPosition = false;
    $('#gps-text').className = '';
    // Fields follow the running average, so the position is usable at any moment
    const fill = (r) => {
      if (manualPosition || !form.isConnected) return;
      F.latitude.value = r.lat; F.longitude.value = r.lon;
      F.coordinateUncertainty.value = r.accuracy;
      if (r.altitude !== null) F.altitude.value = r.altitude;
    };
    gps = sampleGps(secs, ({ fixes, best, elapsed, avg }) => {
      $('#gps-bar').style.width = `${Math.min(100, (elapsed / secs) * 100)}%`;
      $('#gps-text').textContent = fixes
        ? `${fixes} fixes, accuracy ±${avg?.accuracy ?? Math.round(best)} m`
        : `Waiting for satellites ${Math.round(elapsed)} s`;
      if (avg) fill(avg);
    });
    gps.promise.then((r) => {
      if (!form.isConnected) return;
      fill(r);
      $('#gps-text').textContent = `${r.n} fixes, accuracy ±${r.accuracy} m`;
      $('#gps-text').className = r.accuracy <= s.maxAccuracy ? 'good' : 'warn';
      refreshStations();
    }).catch((e) => {
      if (!form.isConnected || manualPosition) return;
      $('#gps-text').textContent = e.message;
      $('#gps-text').className = 'warn';
    }).finally(() => { if (form.isConnected) $('#gps-btn').disabled = false; gps = null; });
  };
  $('#gps-btn').addEventListener('click', startGps);
  // Typing coordinates by hand stops the GPS from overwriting them
  for (const name of ['latitude', 'longitude', 'coordinateUncertainty']) {
    F[name].addEventListener('input', () => { manualPosition = true; gps?.stop(); });
  }
  if (!editing && !F.latitude.value) startGps();

  // ----- compass -----
  $('#compass-btn').addEventListener('click', async () => {
    if (stopCompass) { stopCompass(); stopCompass = null; $('#compass-btn span').textContent = 'Compass'; return; }
    try {
      let got = false;
      stopCompass = await startCompass((h) => {
        got = true;
        F.cameraHeading.value = Math.round(h) % 360;
      });
      $('#compass-btn span').textContent = 'Lock';
    } catch (e) { toast(e.message, 'error'); }
  });

  // ----- copy last setup -----
  $('#copy-last')?.addEventListener('click', () => {
    for (const k of ['cameraHeight', 'cameraTilt', 'detectionDistance', 'cameraFov', 'cameraDelay', 'setupBy']) {
      if (last[k] !== null && last[k] !== undefined && F[k]) F[k].value = last[k];
    }
    F.baitUse.checked = !!last.baitUse;
    toast(`Setup copied from ${last.locationId}`);
  });

  // ----- submit -----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = readForm(form);
    const out = { env: {} };
    for (const [k, val] of Object.entries(raw)) {
      if (k.startsWith('env_')) { if (val !== '') out.env[k.slice(4)] = val; continue; }
      if (k === 'stationMode' || k === 'clock') continue;
      out[k] = NUM_FIELDS.includes(k) ? (val === '' ? null : Number(val)) : val;
    }
    out.deploymentStart = fromInputDateTime(raw.deploymentStart);
    if ('deploymentEnd' in raw) out.deploymentEnd = fromInputDateTime(raw.deploymentEnd);
    out.timestampIssues = raw.clock === 'ok' ? false : null;
    out.baitUse = !!raw.baitUse;

    const check = { ...out };
    if (editing) { check.deviceUid = editing.deviceUid; check.locationId = editing.locationId; }
    else if (raw.stationMode === 'existing') {
      check.locationId = freeLocations.find((l) => l.uid === raw.locationUid)?.locationId;
      delete out.locationId; delete out.locationName;
    } else {
      delete out.locationUid;
    }
    const res = validateDeployment(check, s);
    for (const ef of s.envFields) {
      const val = out.env[ef.key];
      if (val === undefined) continue;
      if (ef.type === 'integer' && !/^-?\d+$/.test(val)) res.errors[`env_${ef.key}`] = 'Whole number expected';
      if ((ef.type === 'float' || ef.type === 'number') && !isFinite(Number(val))) res.errors[`env_${ef.key}`] = 'Number expected';
    }
    if (!editing && raw.stationMode === 'existing' && !raw.locationUid) res.errors.locationUid = 'Choose a station';
    showFieldMessages(form, res);
    if (Object.keys(res.errors).length) { toast('Fix the highlighted fields', 'error'); return; }
    if (Object.keys(res.warnings).length && !(await ask('Save anyway?', { ok: 'Save', detail: Object.values(res.warnings).join(', ') }))) return;

    try {
      if (editing) {
        await updateDeployment(editing, out);
        toast('Deployment updated');
        location.hash = `${p}/d/${editing.uid}`;
      } else {
        const dep = await createDeployment(project, out);
        toast(`${dep.deviceId} deployed at ${dep.locationId}`);
        location.hash = `${p}/d/${dep.uid}`;
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  return () => { gps?.stop(); stopCompass?.(); pickers.forEach((x) => x?.destroy()); };
}
