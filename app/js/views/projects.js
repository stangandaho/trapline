import { listProjects, restore } from '../store.js';
import { parseBackup } from '../export.js';
import { unzip, isZip } from '../zip.js';
import { $, esc, toast, pickFile, icons, ask } from '../ui.js';
import { formatDate } from '../util.js';
import { langSwitch } from './shell.js';

export async function projectsView({ root, rerender }) {
  const projects = (await listProjects()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
    <header class="topbar home">
      <div class="brand">
        <img src="icons/icon-64.png" alt="" width="32" height="32">
        <h1>Trapline</h1>
      </div>
      <div class="topbar-actions">${langSwitch()}</div>
    </header>
    <main class="content no-tabbar home-main">
      ${projects.length ? '<h2 class="section-title">Projects</h2>' : ''}
      <div class="list">
        ${projects.map((p) => `
          <a class="card link-card" href="#/p/${p.id}/stations">
            <div class="card-row">
              <div>
                <h3>${esc(p.name)}</h3>
                ${p.description ? `<p class="muted">${esc(p.description)}</p>` : ''}
              </div>
              <span class="chev">›</span>
            </div>
          </a>`).join('')}
      </div>

      <div class="actions">
        <a class="btn primary" href="#/new">${icons.plus}New project</a>
        <button class="btn outline" id="restore">Restore backup</button>
      </div>
    </main>`;


  $('#restore').addEventListener('click', async () => {
    // No type filter: files received by WhatsApp or e-mail often lose their type
    const file = await pickFile('');
    if (!file) return;
    try {
      // The exported zip (its backup .json is used) or a bare .json backup
      const bytes = new Uint8Array(await file.arrayBuffer());
      let text;
      if (isZip(bytes)) {
        const entries = await unzip(bytes);
        const json = Object.keys(entries).find((n) => /backup\.json$/i.test(n)) ?? Object.keys(entries).find((n) => n.endsWith('.json'));
        if (!json) throw new Error('No backup found in this zip');
        text = new TextDecoder().decode(entries[json]);
      } else {
        text = new TextDecoder().decode(bytes);
      }
      const data = parseBackup(text);
      const exists = projects.find((p) => p.id === data.project.id);
      if (exists && !(await ask(`Replace ${exists.name} with the backup of ${formatDate(data.exportedAt)}?`, { ok: 'Replace', danger: true }))) return;
      await restore(data);
      toast(`${data.project.name} restored`);
      rerender();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
