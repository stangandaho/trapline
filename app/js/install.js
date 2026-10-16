// "Install app" support. Chromium browsers (Chrome, Edge, Samsung Internet…)
// fire beforeinstallprompt when the app can be installed; we keep the event so
// Settings can offer an Install button. Safari and Firefox never fire it, so
// the button simply never appears there.

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // show our button instead of the browser's mini banner
  deferred = e;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export const canInstall = () => !!deferred && !standalone();

/** Subscribe to availability changes; returns an unsubscribe function. */
export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Show the browser's install dialog. Resolves true when the user accepted. */
export async function install() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null; // the event can only be used once
  e.prompt();
  const { outcome } = await e.userChoice;
  notify();
  return outcome === 'accepted';
}
