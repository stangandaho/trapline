import { projectData, saveProject, deleteProject, backup } from '../store.js';
import { deploymentsCSV, checksCSV, devicesCSV, exportIssues, fileStamp } from '../export.js';
import { PROVIDERS } from '../tiles.js';
import { envEditorHTML, bindEnvEditor } from './env.js';
import { getMeta, setMeta } from '../db.js';
import { $, esc, readForm, toast, download, share, options, icons, ask } from '../ui.js';
import { formatDate, safeId } from '../util.js';
import { layout } from './shell.js';
import { zipBytes } from '../zip.js';
import { canInstall, onInstallChange, install } from '../install.js';

export async function moreView({ root, project, rerender }) {
  const s = project.settings;
  const data = await projectData(project.id);
  const issues = exportIssues(data.deployments);
  const lastBackup = await getMeta(`lastBackup:${project.id}`);
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const slug = safeId(project.name).slice(0, 40) || 'project';

  root.innerHTML = layout({
    project, title: 'Settings', tab: 'more',
    body: `
      <div id="install-slot"></div>
      <section class="card">
        <h2>Export</h2>
        <label class="check"><input type="checkbox" id="only-closed"> Only closed deployments</label>
        <div class="btn-pair">
          <button class="btn primary" id="export">${icons.download}Export</button>
          <button class="btn outline" id="share">${icons.share}Share</button>
        </div>
        <p class="small ${lastBackup ? 'muted' : 'warn-text'}" id="last-backup">Last backup: ${lastBackup ? formatDate(lastBackup) : 'never'}</p>
        ${issues.length ? `<details class="issues"><summary>${issues.length} item(s) to complete</summary><ul>${issues.slice(0, 50).map((i) => `<li class="small">${esc(i)}</li>`).join('')}</ul></details>` : '<p class="small good-text">All deployments complete</p>'}
      </section>

      <form class="card" id="settings">
        <h2>Project settings</h2>
        <div class="field"><label for="s-name">Project name</label><input id="s-name" name="name" value="${esc(project.name)}" required></div>
        <div class="field"><label for="s-desc">Description</label><input id="s-desc" name="description" value="${esc(project.description)}"></div>
        <div class="field"><label for="s-obs">Default observer</label><input id="s-obs" name="observer" value="${esc(s.observer)}" autocomplete="name"></div>
        <div class="grid3">
          <div class="field"><label for="s-acc">GPS target (m)</label><input id="s-acc" name="maxAccuracy" type="number" min="1" value="${s.maxAccuracy}"></div>
          <div class="field"><label for="s-gps">GPS averaging (s)</label><input id="s-gps" name="gpsSeconds" type="number" min="3" max="300" value="${s.gpsSeconds}"></div>
          <div class="field"><label for="s-int">Check every (days)</label><input id="s-int" name="checkIntervalDays" type="number" min="1" value="${s.checkIntervalDays}"></div>
        </div>
        <div class="field"><label>Environmental variables</label>
          ${envEditorHTML(s.envFields)}</div>
        <div class="field"><label for="s-tiles">Base map</label>
          <select id="s-tiles" name="tileProvider">${options(Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.name])), s.tileProvider)}</select></div>
        <div class="field" id="custom-url" ${s.tileProvider === 'custom' ? '' : 'hidden'}><label for="s-url">Tile URL template</label>
          <input id="s-url" name="customTileUrl" value="${esc(s.customTileUrl)}" placeholder="https://server/{z}/{x}/{y}.png"></div>
        <button class="btn primary block" type="submit">Save settings</button>
      </form>

      <section class="card">
        <h2>Storage</h2>
        <p class="small">${est ? `${(est.usage / 1048576).toFixed(1)} MB used of ${(est.quota / 1048576).toFixed(0)} MB` : 'Storage estimate not available'}
        ${persisted ? '' : '<br>Install the app (Add to Home screen) to protect your data'}</p>
      </section>

      <button class="btn danger outline block" id="del-project">Delete this project</button>
`,
  });

  // One zip with every table plus the full backup (which can be restored)
  const buildZip = async () => {
    const onlyClosed = $('#only-closed').checked;
    const bytes = zipBytes([
      { name: 'deployments.csv', data: deploymentsCSV(data.deployments, { onlyClosed }) },
      { name: 'checks.csv', data: checksCSV(data.checks, data.deployments) },
      { name: 'cameras.csv', data: devicesCSV(data.devices) },
      { name: 'trapline_backup.json', data: JSON.stringify(await backup(project.id), null, 1) },
    ]);
    return { name: `trapline_${slug}_${fileStamp()}.zip`, content: new Blob([bytes], { type: 'application/zip' }), mime: 'application/zip' };
  };
  const markBackup = async () => {
    const now = new Date().toISOString();
    await setMeta(`lastBackup:${project.id}`, now);
    $('#last-backup').textContent = `Last backup: ${formatDate(now)}`;
    $('#last-backup').className = 'small muted';
  };

  $('#export').addEventListener('click', async () => {
    const z = await buildZip();
    download(z.name, z.content, z.mime);
    await markBackup();
    toast(`${z.name} saved to Downloads`);
  });

  $('#share').addEventListener('click', async () => {
    const z = await buildZip();
    try {
      if (await share([z], `Trapline ${project.name}`)) { await markBackup(); return; }
      toast('Sharing is not available here, use Export', 'error');
    } catch (e) {
      if (e.name !== 'AbortError') toast(e.message, 'error');
    }
  });

  const form = $('#settings');
  const env = bindEnvEditor(form.querySelector('.env-editor'));
  form.elements.tileProvider.addEventListener('change', (e) => { $('#custom-url').hidden = e.target.value !== 'custom'; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = readForm(form);
    let envFields;
    try { envFields = env.read(); } catch (err) { toast(err.message, 'error'); return; }
    if (f.tileProvider === 'custom' && !/\{z\}.*\{x\}.*\{y\}|\{z\}.*\{y\}.*\{x\}/.test(f.customTileUrl)) {
      toast('Custom URL must contain {z}, {x} and {y}', 'error'); return;
    }
    const next = {
      ...project,
      name: f.name || project.name,
      description: f.description,
      settings: {
        ...s,
        observer: f.observer,
        maxAccuracy: Math.max(1, +f.maxAccuracy || 15),
        gpsSeconds: Math.min(300, Math.max(3, +f.gpsSeconds || 20)),
        checkIntervalDays: Math.max(1, +f.checkIntervalDays || 14),
        envFields,
        tileProvider: f.tileProvider,
        customTileUrl: f.customTileUrl ?? '',
      },
    };
    await saveProject(next);
    toast('Settings saved');
    rerender();
  });

  // Install button: only while the browser offers installation
  const showInstall = () => {
    const slot = $('#install-slot');
    if (!slot) return;
    slot.innerHTML = canInstall() ? `<button class="btn primary block install-btn" id="install">${icons.download}Install app</button>` : '';
    $('#install')?.addEventListener('click', async () => {
      if (await install()) toast('App installed');
    });
  };
  showInstall();
  const stopInstallWatch = onInstallChange(showInstall);

  $('#del-project').addEventListener('click', async () => {
    const ok = await ask(`Delete ${project.name}?`, {
      ok: 'Delete', danger: true, typeToConfirm: project.name,
      detail: 'All cameras, deployments and checks are removed from this phone. Type the project name to confirm',
    });
    if (!ok) return;
    await deleteProject(project.id);
    toast('Project deleted');
    location.hash = '#/';
  });

  return stopInstallWatch;
}
