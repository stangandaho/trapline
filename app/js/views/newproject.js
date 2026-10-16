import { saveProject } from '../store.js';
import { newProject } from '../model.js';
import { $, readForm, toast, icons } from '../ui.js';
import { envEditorHTML, bindEnvEditor } from './env.js';
import { langSwitch } from './shell.js';

export async function newProjectView({ root }) {
  root.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" href="#/" aria-label="Back">${icons.back}</a>
      <div class="topbar-title"><h1>New project</h1></div>
      <div class="topbar-actions">${langSwitch()}</div>
    </header>
    <main class="content no-tabbar">
      <form id="np" novalidate>
        <section class="card">
          <div class="field"><label for="np-name">Project name</label>
            <input id="np-name" name="name" required maxlength="80" placeholder="e.g. Parc W dry season 2026"></div>
          <div class="field"><label for="np-desc">Description <span class="opt">optional</span></label>
            <input id="np-desc" name="description" maxlength="200"></div>
        </section>
        <section class="card">
          <h2>Environmental variables</h2>
          ${envEditorHTML([
            { key: '', label: '', type: 'float' },
          ])}
        </section>
        <button class="btn primary block big" type="submit">${icons.plus}Create project</button>
      </form>
    </main>`;

  const form = $('#np');
  const env = bindEnvEditor(form.querySelector('.env-editor'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = readForm(form);
    if (!f.name) { toast('Give the project a name', 'error'); form.elements.name.focus(); return; }
    let envFields;
    try { envFields = env.read(); } catch (err) { toast(err.message, 'error'); return; }
    const p = newProject(f.name, f.description);
    p.settings.envFields = envFields;
    await saveProject(p);
    toast('Project created, now add your cameras');
    location.hash = `#/p/${p.id}/devices`;
  });
}
