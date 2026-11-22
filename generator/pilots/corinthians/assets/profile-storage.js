// Personal data is scoped to the active profile. Old unscoped keys are never adopted.
const PREFIX = 'bbs:profile:v2:';
let identity = 'guest';
let revision = 0;
const fallback = new Map();

function backend() {
  try {
    return globalThis.sessionStorage || null;
  } catch { return null; }
}

export function profileToken() { return `${identity}:${revision}`; }
export function profileKey(key) { return `${PREFIX}${encodeURIComponent(identity)}:${key}`; }

export function readProfileText(key, otherwise = '') {
  try { return backend()?.getItem(profileKey(key)) ?? fallback.get(profileKey(key)) ?? otherwise; }
  catch { return otherwise; }
}

export function writeProfileText(key, value) {
  const scoped = profileKey(key);
  try {
    if (backend()) backend().setItem(scoped, String(value));
    else fallback.set(scoped, String(value));
  } catch { fallback.set(scoped, String(value)); }
}

export function removeProfileValue(key) {
  try { backend()?.removeItem(profileKey(key)); } catch {}
  fallback.delete(profileKey(key));
}

function notify(detail = {}) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('bbs:profile-change', { detail }));
  }
}

export function clearProfileSession({ all = false, silent = false } = {}) {
  const prefix = all ? PREFIX : profileKey('');
  try {
    const store = backend();
    const keys = Array.from({ length: store?.length || 0 }, (_, i) => store.key(i));
    keys.filter(key => key?.startsWith(prefix)).forEach(key => store.removeItem(key));
  } catch {}
  for (const key of fallback.keys()) if (key.startsWith(prefix)) fallback.delete(key);
  revision++;
  if (!silent) notify({ reason: 'clear' });
}

export function setActiveProfile(user) {
  const next = user?.uid ? `user:${user.uid}` : 'guest';
  if (next === identity) return;
  // Shared-device sessions are deliberately forgotten at every identity transition.
  const previous = identity;
  clearProfileSession({ silent: true });
  identity = next;
  revision++;
  notify({ reason: 'account', previous, identity, anonymous: user?.isAnonymous === true });
}

export function legacyDeviceData() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (/^bbs:(notes?:|verse-menu:|suggest-panel:|authorName|scoreboardOptIn|cor:stats)/.test(key)) {
        data[key] = localStorage.getItem(key);
      }
    }
  } catch {}
  return data;
}

export function deleteLegacyDeviceData() {
  for (const key of Object.keys(legacyDeviceData())) localStorage.removeItem(key);
}
