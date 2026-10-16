// Editor for the project's environmental variables, used on the New project
// page and in settings. Each row: name, type (Number / Text), and for Text an
// optional comma-separated list of choices (shown as a drop-down when deploying).

import { esc, icons } from '../ui.js';
import { buildEnvFields } from '../model.js';

function rowHTML(f = {}) {
  const type = f.type === 'integer' ? 'integer' : f.type === 'float' || f.type === 'number' ? 'float' : 'text';
  const opts = f.type === 'select' ? f.options.join(', ') : '';
  return `
    <div class="env-row" data-key="${esc(f.key ?? '')}">
      <div class="env-main">
        <input class="env-name" placeholder="Name" value="${esc(f.label ?? '')}" aria-label="Variable name">
        <select class="env-type" aria-label="Data type">
          <option value="integer"${type === 'integer' ? ' selected' : ''}>Integer</option>
          <option value="float"${type === 'float' ? ' selected' : ''}>Float</option>
          <option value="text"${type === 'text' ? ' selected' : ''}>Text</option>
        </select>
        <button type="button" class="icon-btn env-del" aria-label="Remove variable">${icons.close}</button>
      </div>
      <input class="env-opts" placeholder="Choices, comma separated (optional)" value="${esc(opts)}" aria-label="Choices" ${type === 'text' ? '' : 'hidden'}>
    </div>`;
}

export function envEditorHTML(fields = []) {
  return `
    <div class="env-editor">
      <div class="env-rows">${fields.map(rowHTML).join('')}</div>
      <button type="button" class="btn outline small env-add">${icons.plus}Add variable</button>
    </div>`;
}

/** Wire an editor rendered with envEditorHTML(). Returns { read } (throws on invalid input). */
export function bindEnvEditor(container) {
  const rows = container.querySelector('.env-rows');
  const add = () => {
    rows.insertAdjacentHTML('beforeend', rowHTML());
    rows.lastElementChild.querySelector('.env-name').focus();
  };
  container.querySelector('.env-add').addEventListener('click', add);
  container.addEventListener('click', (e) => {
    const del = e.target.closest('.env-del');
    if (del) del.closest('.env-row').remove();
  });
  container.addEventListener('change', (e) => {
    if (!e.target.classList.contains('env-type')) return;
    const opts = e.target.closest('.env-row').querySelector('.env-opts');
    opts.hidden = e.target.value !== 'text';
    if (!opts.hidden) opts.focus();
  });
  return {
    read: () => buildEnvFields([...rows.querySelectorAll('.env-row')].map((r) => ({
      key: r.dataset.key || null,
      name: r.querySelector('.env-name').value,
      type: r.querySelector('.env-type').value,
      options: r.querySelector('.env-type').value === 'text' ? r.querySelector('.env-opts').value : '',
    }))),
  };
}
