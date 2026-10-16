import { projectData } from '../store.js';
import { checkUrgency } from '../model.js';
import { providerFor, offlineLayer, estimateDownload, downloadRegion, cachedTileCount, clearTiles, MAX_DOWNLOAD_TILES } from '../tiles.js';
import { $, esc, toast, icons, ask } from '../ui.js';
import { haversine, bearing, cardinal, formatDistance, pathLength, formatDate } from '../util.js';

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
import { watchPosition, startCompass } from '../sensors.js';
import { layout, meta, svgIcon } from './shell.js';

const COLORS = { ok: '#2f7d4f', due: '#b26a00', overdue: '#b3261e', closed: '#a8938f', me: '#2563eb', measure: '#7f4841' };

export async function mapView({ root, project, query }) {
  const p = `#/p/${project.id}`;
  const { deployments, checks } = await projectData(project.id);
  const provider = providerFor(project.settings);

  root.innerHTML = layout({
    project, title: 'Map', tab: 'map', mainClass: 'map-main',
    body: `
      <div id="map" class="map"></div>
      <div class="map-tools">
        <button class="fab" id="t-locate" aria-label="Center on my position">${icons.gps}</button>
        <button class="fab" id="t-measure" aria-label="Measure distance">${icons.ruler}</button>
        <button class="fab" id="t-offline" aria-label="Offline map">${icons.download}</button>
      </div>
      <div class="map-badge" id="gps-badge">GPS</div>
      <div class="sheet" id="sheet" hidden></div>`,
  });

  const map = L.map('map', { zoomControl: false, attributionControl: true });
  L.control.zoom({ position: 'topleft' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  offlineLayer(provider).addTo(map);

  // ----- stations -----
  const checksBy = {};
  for (const c of checks) (checksBy[c.deploymentUid] ??= []).push(c);
  const markers = {};
  const stationLayer = L.layerGroup().addTo(map);
  // Show the latest deployment per station, active first
  const sorted = deployments.slice().sort((a, b) => (a.status === 'active') - (b.status === 'active') || a.deploymentStart.localeCompare(b.deploymentStart));
  for (const d of sorted) {
    const active = d.status === 'active';
    const lvl = active ? checkUrgency(d, checksBy[d.uid] ?? [], project.settings.checkIntervalDays).level : 'closed';
    const m = L.circleMarker([d.latitude, d.longitude], {
      radius: active ? 9 : 6, color: '#fff', weight: 2, fillColor: COLORS[lvl], fillOpacity: active ? 0.95 : 0.7,
    }).addTo(stationLayer);
    m.bindTooltip(esc(d.locationId), { permanent: active, direction: 'right', offset: [8, 0], className: 'st-label' });
    m.on('click', (e) => {
      if (mode === 'measure') { addMeasurePoint(e.latlng); return; }
      showStation(d);
    });
    markers[d.uid] = m;
  }

  const pts = deployments.map((d) => [d.latitude, d.longitude]);
  if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  else map.setView([9.3, 2.3], 6);

  // ----- my position -----
  let me = null, meMarker = null, meCircle = null, follow = false;
  const stopGps = watchPosition((f) => {
    const first = !me;
    me = f;
    const ll = [f.lat, f.lon];
    if (!meMarker) {
      meCircle = L.circle(ll, { radius: f.accuracy, color: COLORS.me, weight: 1, fillOpacity: 0.1, interactive: false }).addTo(map);
      meMarker = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 3, fillColor: COLORS.me, fillOpacity: 1, interactive: false }).addTo(map);
    } else { meMarker.setLatLng(ll); meCircle.setLatLng(ll).setRadius(f.accuracy); }
    $('#gps-badge').textContent = `GPS ±${Math.round(f.accuracy)} m`;
    $('#gps-badge').className = `map-badge ${f.accuracy <= project.settings.maxAccuracy ? 'good' : 'warn'}`;
    if (first && !pts.length) map.setView(ll, 15);
    if (follow) map.panTo(ll);
    updateNav();
  }, (e) => { $('#gps-badge').textContent = 'No GPS'; $('#gps-badge').title = e.message; });

  $('#t-locate').addEventListener('click', () => {
    if (!me) { toast('Waiting for GPS'); return; }
    follow = !follow;
    $('#t-locate').classList.toggle('on', follow);
    if (follow) map.setView([me.lat, me.lon], Math.max(map.getZoom(), 16));
  });
  map.on('dragstart', () => { follow = false; $('#t-locate').classList.remove('on'); });

  // ----- bottom sheet -----
  const sheet = $('#sheet');
  let mode = null; // null | 'nav' | 'measure' | 'offline'
  let target = null, navLine = null, heading = null, stopCompass = null;
  const closeSheet = () => {
    sheet.hidden = true; sheet.innerHTML = '';
    if (mode === 'nav') { navLine?.remove(); navLine = null; target = null; stopCompass?.(); stopCompass = null; heading = null; }
    if (mode === 'measure') { measureLayer.clearLayers(); measurePts = []; $('#t-measure').classList.remove('on'); }
    if (mode === 'offline') { dl?.abort(); boxLayer?.remove(); boxLayer = null; }
    mode = null;
  };
  const openSheet = (m, html) => {
    if (mode && mode !== m) closeSheet();
    mode = m; sheet.hidden = false; sheet.innerHTML = html;
    sheet.querySelector('[data-close]')?.addEventListener('click', closeSheet);
  };

  function showStation(d) {
    const c = (checksBy[d.uid] ?? []).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const dist = me ? haversine(me.lat, me.lon, d.latitude, d.longitude) : null;
    openSheet('station', `
      <div class="sheet-head"><h3>${esc(d.locationId)}${d.locationName ? ` <span class="muted">${esc(d.locationName)}</span>` : ''}</h3>
        <button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
      ${meta([`<b>${esc(d.deviceId)}</b>`, d.status === 'active' ? 'Active' : esc(cap(d.endReason ?? d.status)), c ? `Checked ${formatDate(c.timestamp, false)}` : '', dist !== null ? `${formatDistance(dist)} away` : ''])}
      <div class="btn-row">
        <button class="btn primary" id="go">${icons.compass}Go to</button>
        ${d.status === 'active' ? `<a class="btn" href="${p}/d/${d.uid}/check">Check</a>` : ''}
        <a class="btn" href="${p}/d/${d.uid}">Details</a>
      </div>`);
    $('#go').addEventListener('click', () => startNav(d));
  }

  // ----- go to station -----
  function startNav(d) {
    target = d;
    openSheet('nav', `
      <div class="sheet-head"><h3>To ${esc(d.locationId)}</h3>
        <button class="icon-btn" data-close aria-label="Stop navigation">${icons.close}</button></div>
      <div class="nav">
        <div class="nav-arrow" id="nav-arrow">${icons.arrow}</div>
        <div>
          <div class="nav-dist" id="nav-dist">--</div>
          <div class="nav-bear" id="nav-bear">Waiting for GPS</div>
        </div>
      </div>
      <button class="btn small" id="nav-compass">${icons.compass}Use compass</button>`);
    $('#nav-compass').addEventListener('click', async () => {
      if (stopCompass) return;
      try {
        stopCompass = await startCompass((h) => { heading = h; updateNav(); });
        $('#nav-compass').textContent = 'Compass on';
      } catch (e) { toast(e.message, 'error'); }
    });
    if (me) map.fitBounds([[me.lat, me.lon], [d.latitude, d.longitude]], { padding: [60, 60], maxZoom: 17 });
    else map.setView([d.latitude, d.longitude], 16);
    updateNav();
  }

  function updateNav() {
    if (mode !== 'nav' || !target || !me) return;
    const dist = haversine(me.lat, me.lon, target.latitude, target.longitude);
    const b = bearing(me.lat, me.lon, target.latitude, target.longitude);
    const ll = [[me.lat, me.lon], [target.latitude, target.longitude]];
    if (!navLine) navLine = L.polyline(ll, { color: COLORS.me, weight: 3, dashArray: '6 8', interactive: false }).addTo(map);
    else navLine.setLatLngs(ll);
    $('#nav-dist').textContent = formatDistance(dist);
    $('#nav-bear').textContent = `${Math.round(b)}° ${cardinal(b)}${dist < Math.max(10, me.accuracy) ? ', you are there' : ''}`;
    $('#nav-arrow').style.transform = `rotate(${heading === null ? b : b - heading}deg)`;
    $('#nav-arrow').title = heading === null ? 'Arrow relative to north (map up)' : 'Arrow relative to where the phone points';
  }

  // ----- measure -----
  const measureLayer = L.layerGroup().addTo(map);
  let measurePts = [];
  function addMeasurePoint(ll) {
    measurePts.push([ll.lat, ll.lng]);
    drawMeasure();
  }
  function drawMeasure() {
    measureLayer.clearLayers();
    if (measurePts.length > 1) {
      // white halo under the line keeps it visible on light maps and imagery
      L.polyline(measurePts, { color: '#fff', weight: 7, opacity: 0.9, interactive: false }).addTo(measureLayer);
      L.polyline(measurePts, { color: COLORS.measure, weight: 3.5, interactive: false }).addTo(measureLayer);
    }
    measurePts.forEach((pt) => L.circleMarker(pt, { radius: 7, color: '#fff', weight: 3, fillColor: COLORS.measure, fillOpacity: 1, interactive: false }).addTo(measureLayer));
    const total = pathLength(measurePts);
    $('#m-total').textContent = formatDistance(total) || '0 m';
  }
  $('#t-measure').addEventListener('click', () => {
    if (mode === 'measure') { closeSheet(); return; }
    openSheet('measure', `
      <div class="sheet-head"><h3>Measure distance</h3>
        <button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
      <div class="measure-row">
        <div class="nav-dist" id="m-total">0 m</div>
        <div class="icon-tools">
          <button class="btn icon-only" id="m-me" aria-label="Add my position" title="Add my position">${svgIcon('current_location')}</button>
          <button class="btn icon-only" id="m-undo" aria-label="Undo" title="Undo">${svgIcon('undo')}</button>
          <button class="btn icon-only" id="m-clear" aria-label="Clear" title="Clear">${svgIcon('clear_location')}</button>
        </div>
      </div>`);
    $('#t-measure').classList.add('on');
    $('#m-me').addEventListener('click', () => (me ? addMeasurePoint({ lat: me.lat, lng: me.lon }) : toast('No GPS position yet')));
    $('#m-undo').addEventListener('click', () => { measurePts.pop(); drawMeasure(); });
    $('#m-clear').addEventListener('click', () => { measurePts = []; drawMeasure(); });
  });
  map.on('click', (e) => { if (mode === 'measure') addMeasurePoint(e.latlng); });

  // ----- offline tiles -----
  let dl = null, boxLayer = null;
  $('#t-offline').addEventListener('click', async () => {
    if (mode === 'offline') { closeSheet(); return; }
    const z = map.getZoom();
    openSheet('offline', `
      <div class="sheet-head"><h3>Offline map <span class="muted">${esc(provider.name)}</span></h3>
        <button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
      <p class="small muted" id="o-cached"></p>
      ${provider.bulk ? `
        <div class="grid2">
          <div class="field"><label for="o-zmin">From zoom</label><input id="o-zmin" type="number" min="1" max="${provider.maxZoom}" value="${Math.max(1, z)}"></div>
          <div class="field"><label for="o-zmax">To zoom</label><input id="o-zmax" type="number" min="1" max="${provider.maxZoom}" value="${Math.min(provider.maxZoom, Math.max(z, 16))}"></div>
        </div>
        <p class="small" id="o-est"></p>
        <div class="progress" hidden id="o-prog"><div id="o-bar"></div></div>
        <div class="btn-row">
          <button class="btn primary" id="o-go">${icons.download}Download</button>
          <button class="btn danger ghost small" id="o-clear">Delete stored tiles</button>
        </div>`
      : `
          <button class="btn danger ghost small" id="o-clear">Delete stored tiles</button>`}`);
    cachedTileCount(provider).then((n) => { if ($('#o-cached')) $('#o-cached').textContent = `${n} tiles offline`; });
    $('#o-clear').addEventListener('click', async () => {
      if (!(await ask(`Delete all stored ${provider.name} tiles?`, { ok: 'Delete', danger: true }))) return;
      await clearTiles(provider);
      $('#o-cached').textContent = '0 tiles offline';
      toast('Stored tiles deleted');
    });
    if (!provider.bulk) return;
    const estimate = () => {
      const zmin = +$('#o-zmin').value, zmax = +$('#o-zmax').value;
      const { bbox, count } = estimateDownload(map.getBounds(), zmin, zmax);
      boxLayer?.remove();
      boxLayer = L.rectangle([[bbox.south, bbox.west], [bbox.north, bbox.east]], { color: COLORS.me, weight: 2, fill: false, interactive: false }).addTo(map);
      $('#o-est').innerHTML = `${count.toLocaleString()} tiles, about ${Math.max(1, Math.round(count * 0.02))} MB` +
        (count > MAX_DOWNLOAD_TILES ? `, <b class="bad-text">too many (max ${MAX_DOWNLOAD_TILES.toLocaleString()})</b>` : '');
      return { bbox, zmin, zmax, count };
    };
    estimate();
    $('#o-zmin').addEventListener('input', estimate);
    $('#o-zmax').addEventListener('input', estimate);
    map.on('moveend', () => { if (mode === 'offline' && !dl) estimate(); });
    $('#o-go').addEventListener('click', async () => {
      if (dl) { dl.abort(); return; }
      if (!navigator.onLine) { toast('You are offline, connect to download', 'error'); return; }
      const { bbox, zmin, zmax } = estimate();
      $('#o-prog').hidden = false;
      $('#o-go').textContent = 'Cancel';
      dl = downloadRegion(provider, bbox, zmin, zmax, (st) => {
        $('#o-bar').style.width = `${(st.done / st.total) * 100}%`;
        $('#o-est').textContent = `${st.done} of ${st.total} tiles${st.failed ? `, ${st.failed} failed` : ''}`;
      });
      try {
        const st = await dl.promise;
        toast(`Offline map ready (${st.total - st.failed} tiles)`);
        $('#o-est').textContent = `${st.total - st.failed} tiles available offline${st.failed ? `, ${st.failed} failed, retry to fill gaps` : ''}`;
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        dl = null;
        if ($('#o-go')) $('#o-go').innerHTML = `${icons.download}Download`;
        cachedTileCount(provider).then((n) => { if ($('#o-cached')) $('#o-cached').textContent = `${n} tiles offline`; });
      }
    });
  });

  // Deep link: #/p/<id>/map?goto=<deployment uid>
  if (query.goto) {
    const d = deployments.find((x) => x.uid === query.goto);
    if (d) startNav(d);
  }

  setTimeout(() => map.invalidateSize(), 50);
  return () => { stopGps(); stopCompass?.(); dl?.abort(); map.remove(); };
}
