import { getLang, FLATPICKR_FR } from './i18n.js';

// Small DOM helpers shared by the views.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let toastTimer;
export function toast(msg, kind = 'info') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), kind === 'error' ? 5000 : 2600);
}

/**
 * In-app confirmation dialog (native confirm() is blocked in some webviews).
 * ask('Delete CT01?', { ok: 'Delete', danger: true, detail, typeToConfirm }) → Promise<boolean>
 */
export function ask(message, { ok = 'OK', cancel = 'Cancel', danger = false, detail = '', typeToConfirm = '' } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-backdrop';
    wrap.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-msg">
        <p id="dlg-msg" class="dialog-msg">${esc(message)}</p>
        ${detail ? `<p class="dialog-detail">${esc(detail)}</p>` : ''}
        ${typeToConfirm ? `<input class="dialog-input" placeholder="${esc(typeToConfirm)}" autocomplete="off">` : ''}
        <div class="dialog-actions">
          <button type="button" class="btn" data-r="0">${esc(cancel)}</button>
          <button type="button" class="btn ${danger ? 'danger-solid' : 'primary'}" data-r="1" ${typeToConfirm ? 'disabled' : ''}>${esc(ok)}</button>
        </div>
      </div>`;
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return close(false);
      const b = e.target.closest('[data-r]');
      if (b && !b.disabled) close(b.dataset.r === '1');
    });
    const input = wrap.querySelector('.dialog-input');
    input?.addEventListener('input', () => { wrap.querySelector('[data-r="1"]').disabled = input.value.trim() !== typeToConfirm; });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    (input ?? wrap.querySelector('[data-r="1"]')).focus();
  });
}

/**
 * Date-time picker (bundled flatpickr). The input keeps "YYYY-MM-DDTHH:MM:SS"
 * so fromInputDateTime() still parses it; the user sees "16 Oct 2026, 14:05".
 */
export function dateTimePicker(input, { min = null, max = null } = {}) {
  // Phones: the system date and time picker is the easiest to use with a finger
  if (window.matchMedia?.('(pointer: coarse)').matches || !window.flatpickr) {
    const fmt = (d) => {
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    input.type = 'datetime-local';
    input.step = 60;
    if (input.value) input.value = input.value.slice(0, 16);
    if (min) input.min = fmt(new Date(min));
    if (max) input.max = fmt(new Date(max));
    return { destroy() {} };
  }
  return window.flatpickr(input, {
    enableTime: true,
    time_24hr: true,
    disableMobile: true,
    dateFormat: 'Y-m-d\\TH:i:S',
    altInput: true,
    altFormat: 'j M Y, H:i',
    minDate: min,
    maxDate: max,
    locale: getLang() === 'fr' ? FLATPICKR_FR : { firstDayOfWeek: 1 },
  });
}

/** Read a form into a plain object. Checkboxes → boolean, empty → ''. */
export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  }
  return out;
}

export function options(map, selected, { placeholder } = {}) {
  const entries = Array.isArray(map) ? map.map((v) => [v, v]) : Object.entries(map);
  const ph = placeholder ? `<option value="">${esc(placeholder)}</option>` : '';
  return ph + entries.map(([v, label]) => `<option value="${esc(v)}"${String(v) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

/** Show validation messages next to fields: {errors:{field:msg}, warnings:{...}} */
export function showFieldMessages(form, { errors = {}, warnings = {} }) {
  $$('.field-msg', form).forEach((e) => e.remove());
  $$('.invalid', form).forEach((e) => e.classList.remove('invalid'));
  for (const [kind, msgs] of [['error', errors], ['warning', warnings]]) {
    for (const [name, msg] of Object.entries(msgs)) {
      const el = form.elements[name];
      const host = el?.closest?.('.field') ?? null;
      if (!host) continue;
      if (kind === 'error') el.classList.add('invalid');
      host.insertAdjacentHTML('beforeend', `<div class="field-msg ${kind}">${esc(msg)}</div>`);
    }
  }
  const first = $('.invalid', form);
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Use the OS share sheet (WhatsApp, e-mail, Drive…) when it supports files. */
export async function share(files, title) {
  const fs = files.map((f) => new File([f.content], f.name, { type: f.mime }));
  if (navigator.canShare?.({ files: fs })) {
    await navigator.share({ files: fs, title });
    return true;
  }
  return false;
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = () => resolve(input.files[0] ?? null);
    input.click();
  });
}

export const icons = {
  stations: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  devices: '<svg viewBox="0 0 24 24"><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm6 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM7 5.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M15 5.1 9 3 3 5v16l6-2.1 6 2.1 6-2V3zM10 5.4l4 1.4v11.8l-4-1.4z"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  gps: '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 3h-2.1A7 7 0 0 0 13 5.1V3h-2v2.1A7 7 0 0 0 5.1 11H3v2h2.1a7 7 0 0 0 5.9 5.9V21h2v-2.1a7 7 0 0 0 5.9-5.9H21zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>',
  ruler: '<svg viewBox="0 0 24 24"><path d="m2 16.6 13.4-13.4 5.4 5.4L7.4 22zm3 0 .9.9 1.4-1.4.7.7 1.4-1.4-.7-.7 1.4-1.4 1.4 1.4 1.4-1.4-1.4-1.4 1.4-1.4.7.7 1.4-1.4-.7-.7 1.4-1.4 1.4 1.4 1.4-1.4-1.4-1.4-.9-.9z"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="m12 3 10 6-10 6L2 9zm-7.5 9.4L12 17l7.5-4.6L22 14l-10 6-10-6z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16 6.3 10.3l1.4-1.4 3.3 3.3zM4 18h16v2H4z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M12 2 5 20l7-4 7 4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  compass: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-5.5-2.5 7.5-3.5 3.5-7.5-7.5 3.5zm5.5-6.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/></svg>',
};
