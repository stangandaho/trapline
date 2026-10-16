import { openDB } from './db.js';
import './install.js';
import { startTranslating, setLang } from './i18n.js';
import { getProject } from './store.js';
import { $, esc, toast } from './ui.js';
import { projectsView } from './views/projects.js';
import { newProjectView } from './views/newproject.js';
import { stationsView, deploymentView } from './views/stations.js';
import { devicesView, deviceFormView, bulkDevicesView } from './views/devices.js';
import { deployFormView } from './views/deploy.js';
import { checkFormView } from './views/check.js';
import { mapView } from './views/map.js';
import { moreView } from './views/more.js';

const routes = [
  [/^$/, projectsView, false],
  [/^new$/, newProjectView, false],
  [/^p\/([^/]+)\/?(stations)?$/, stationsView, true],
  [/^p\/([^/]+)\/devices$/, devicesView, true],
  [/^p\/([^/]+)\/devices\/new$/, deviceFormView, true],
  [/^p\/([^/]+)\/devices\/bulk$/, bulkDevicesView, true],
  [/^p\/([^/]+)\/devices\/([^/]+)$/, deviceFormView, true],
  [/^p\/([^/]+)\/deploy$/, deployFormView, true],
  [/^p\/([^/]+)\/d\/([^/]+)$/, deploymentView, true],
  [/^p\/([^/]+)\/d\/([^/]+)\/edit$/, deployFormView, true],
  [/^p\/([^/]+)\/d\/([^/]+)\/check$/, checkFormView, true],
  [/^p\/([^/]+)\/map$/, mapView, true],
  [/^p\/([^/]+)\/more$/, moreView, true],
];

let cleanup = null;
let renderId = 0;

async function render() {
  const id = ++renderId;
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs ?? ''));
  const root = $('#app');
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;

  for (const [re, view, needsProject] of routes) {
    const m = re.exec(path);
    if (!m) continue;
    try {
      let project = null;
      if (needsProject) {
        project = await getProject(m[1]);
        if (!project) { location.hash = '#/'; return; }
      }
      const params = m.slice(needsProject ? 2 : 1).filter((x) => x !== undefined && x !== 'stations');
      const ctx = { root, project, params, query, rerender: render, isCurrent: () => id === renderId };
      const c = await view(ctx);
      if (id !== renderId) { if (typeof c === 'function') c(); return; }
      cleanup = c;
      root.scrollTop = 0;
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="content"><div class="card error-card"><h2>Something went wrong</h2><p>${esc(e.message)}</p><a class="btn" href="#/">Back to projects</a></div></div>`;
    }
    return;
  }
  location.hash = '#/';
}

async function boot() {
  try {
    await openDB();
  } catch (e) {
    $('#app').innerHTML = `<div class="content"><div class="card error-card"><h2>Storage unavailable</h2><p>${esc(e.message)}</p><p class="muted">Private browsing may block offline storage</p></div></div>`;
    return;
  }
  // Ask the browser not to evict our data under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener('hashchange', render);
  startTranslating();
  // EN | FR switch: re-render the current screen in the chosen language
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    setLang(b.dataset.lang);
    render();
  });
  window.addEventListener('online', () => toast('Back online'));
  window.addEventListener('offline', () => toast('Offline, everything keeps working'));
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // When a new version takes over, reload once so the screen shows it
    // (skipped on the very first install, when there was no previous version).
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    const onForm = () => /\/(deploy|edit|check|new|bulk)$|\/devices\/[^/]+$|^#\/new$/.test(location.hash);
    const reloadNow = () => { if (!reloaded) { reloaded = true; location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      // Never wipe a form being filled in: wait until the user leaves it
      if (onForm()) window.addEventListener('hashchange', reloadNow, { once: true });
      else reloadNow();
    });
    navigator.serviceWorker.register('sw.js')
      .then((reg) => reg.update())
      .catch((e) => console.warn('SW registration failed', e));
  }
}

boot();
