import { preference, setPreference } from './preferences.mjs';
export const normalizeAtmosphere = value => value === 'evening' ? 'evening' : 'day';
const OFFSET = 330 * 60 * 1000, HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;
const OVERRIDE = 'aroha-atmosphere-override';
let manual;
// IST is UTC+05:30 year-round. This is an editorial 06:00/18:00 schedule,
// not a claim to predict astronomical sunrise or sunset.
export function arohaClock(now = Date.now()) {
  const local = now + OFFSET, midnight = Math.floor(local / DAY) * DAY;
  const morning = midnight + 6 * HOUR, evening = midnight + 18 * HOUR;
  return { value: local >= morning && local < evening ? 'day' : 'evening',
    next: (local < morning ? morning : local < evening ? evening : morning + DAY) - OFFSET };
}
export function resolveAtmosphere(now = Date.now(), override) {
  const clock = arohaClock(now);
  return override && ['day','evening'].includes(override.value) &&
    Number.isFinite(override.until) && override.until > now && override.until <= clock.next
    ? override.value : clock.value;
}
function selected(now = Date.now()) {
  let stored;
  try { stored = JSON.parse(preference(OVERRIDE)); } catch {}
  return resolveAtmosphere(now, manual || stored);
}
function apply(value, announce = false) {
  if (typeof document !== 'undefined') document.documentElement.dataset.atmosphere = value === 'evening' ? 'sunset' : 'day';
  if (announce && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('aroha:atmosphere', {detail: value}));
  return value;
}
export function atmospherePreference() {
  const current = typeof document !== 'undefined' ? document.documentElement.dataset.atmosphere : null;
  if (current === 'sunset' || current === 'day') return current === 'sunset' ? 'evening' : 'day';
  return selected();
}
export function restoreAtmosphere() { return apply(selected()); }
export function setAtmosphere(value) {
  value = normalizeAtmosphere(value);
  manual = {value, until: arohaClock().next};
  setPreference(OVERRIDE, JSON.stringify(manual));
  apply(value, true);
}
// Installed once by the pre-paint public bootstrap. Cross-bundle manual events
// also preserve an override in memory when localStorage is unavailable.
export function startAtmosphereClock() {
  let timer, broadcasting = false;
  function schedule() {
    clearTimeout(timer);
    if (!document.hidden) timer = setTimeout(sync, Math.max(100, arohaClock().next - Date.now() + 20));
  }
  function sync() {
    const value = selected(), previous = atmospherePreference();
    broadcasting = true;
    apply(value, value !== previous);
    broadcasting = false;
    schedule();
  }
  function choice(event) {
    if (broadcasting) return;
    manual = {value:normalizeAtmosphere(event.detail), until:arohaClock().next};
    schedule();
  }
  restoreAtmosphere();
  window.addEventListener('aroha:atmosphere', choice);
  window.addEventListener('pageshow', sync);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  document.addEventListener('visibilitychange', sync);
  schedule();
}
export function watchAtmosphere(listener) {
  if (typeof window === 'undefined') return () => {};
  const update = event => listener(normalizeAtmosphere(event.detail));
  window.addEventListener('aroha:atmosphere', update);
  return () => window.removeEventListener('aroha:atmosphere', update);
}
