import { esc, icons } from '../ui.js';
import { getLang } from '../i18n.js';
import { canInstall } from '../install.js';

/** Top bar + content + bottom tab bar for project screens. */
export function layout({ project, title, back, tab, body, actions = '', mainClass = '' }) {
  const p = `#/p/${project.id}`;
  const navItem = (key, label, file) =>
    `<a class="tab ${tab === key ? 'active' : ''}" href="${p}/${key}">${svgIcon(file)}<span>${label}</span></a>`;
  return `
    <header class="topbar">
      ${back ? `<a class="icon-btn" href="${back}" aria-label="Back">${icons.back}</a>` : `<a class="icon-btn" href="#/" aria-label="Projects">${icons.back}</a>`}
      <div class="topbar-title">
        <h1>${esc(title)}</h1>
        ${title !== project.name ? `<div class="sub">${esc(project.name)}</div>` : ''}
      </div>
      <div class="topbar-actions">${actions}${langSwitch()}</div>
    </header>
    <main class="content ${mainClass}">${body}</main>
    <nav class="tabbar">
      ${navItem('stations', 'Stations', 'station')}
      ${navItem('devices', 'Cameras', 'camera')}
      <a class="tab deploy-tab ${tab === 'deploy' ? 'active' : ''}" href="${p}/deploy">${svgIcon('deploy')}<span>Deploy</span></a>
      ${navItem('map', 'Map', 'map')}
      ${navItem('more', 'Settings', 'settings')}
    </nav>`;
}

/** One button showing the current language; tapping it switches to the other. */
export function langSwitch() {
  const l = getLang();
  const next = l === 'en' ? 'fr' : 'en';
  const inst = canInstall() ? '<button type="button" class="install-btn" data-install>Install</button>' : '';
  return `<span class="install-slot">${inst}</span><button type="button" class="lang" data-lang="${next}" aria-label="Language">${l.toUpperCase()}</button>`;
}

/** Icon from app/icons/<name>.svg, coloured with currentColor through a CSS mask. */
export function svgIcon(name) {
  return `<i class="ico" style="--ico:url('icons/${name}.svg')" aria-hidden="true"></i>`;
}

export function empty(msg, cta = '') {
  return `<div class="empty"><p>${msg}</p>${cta}</div>`;
}

/** Status label: coloured, first letter upper case. */
export function badge(text, kind) {
  const t = String(text ?? '');
  return `<span class="badge ${kind}">${esc(t.charAt(0).toUpperCase() + t.slice(1))}</span>`;
}

/** Secondary info as separate spaced items (no separator characters). */
export function meta(items) {
  const list = items.filter(Boolean);
  return list.length ? `<div class="meta">${list.map((i) => `<span>${i}</span>`).join('')}</div>` : '';
}

export const statusKind = {
  available: 'ok', deployed: 'info', maintenance: 'warn', lost: 'bad',
  active: 'ok', ended: 'muted', inactive: 'warn', damaged: 'warn', stolen: 'bad',
};
