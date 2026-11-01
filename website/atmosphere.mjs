import { preference, setPreference } from './preferences.mjs';
export const normalizeAtmosphere = value => value === 'evening' ? 'evening' : 'day';
export function atmospherePreference() {
  // Keep the current document usable even when preference storage is denied.
  const current = typeof document !== 'undefined' ? document.documentElement.dataset.atmosphere : null;
  if (current === 'sunset' || current === 'day') return current === 'sunset' ? 'evening' : 'day';
  return normalizeAtmosphere(preference('aroha-atmosphere'));
}
export function restoreAtmosphere() {
  const value = normalizeAtmosphere(preference('aroha-atmosphere'));
  if (typeof document !== 'undefined') document.documentElement.dataset.atmosphere = value === 'evening' ? 'sunset' : 'day';
  return value;
}
export function setAtmosphere(value) {
  value = normalizeAtmosphere(value);
  setPreference('aroha-atmosphere', value);
  if (typeof document !== 'undefined') document.documentElement.dataset.atmosphere = value === 'evening' ? 'sunset' : 'day';
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('aroha:atmosphere', {detail: value}));
}
export function watchAtmosphere(listener) {
  if (typeof window === 'undefined') return () => {};
  const update = event => listener(normalizeAtmosphere(event.detail));
  window.addEventListener('aroha:atmosphere', update);
  return () => window.removeEventListener('aroha:atmosphere', update);
}
