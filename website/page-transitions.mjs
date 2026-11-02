import { restoreAtmosphere } from './atmosphere.mjs';
import { PUBLIC_PAGES } from './public-pages.mjs';

const ARRIVAL_KEY = 'aroha-route-arrival';
export function publicDestination(href, current) {
  try {
    const from = new URL(current), to = new URL(href, from);
    return to.origin === from.origin && to.pathname !== from.pathname &&
      PUBLIC_PAGES.some(p => p.href === from.pathname) &&
      PUBLIC_PAGES.some(p => p.href === to.pathname) &&
      !to.searchParams.has('preview') && !from.searchParams.has('preview') ? to : null;
  } catch { return null; }
}
export function validArrival(record, current, now) {
  return record && typeof record.to === 'string' &&
    record.to === current && Number.isFinite(record.at) &&
    now >= record.at && now - record.at < 15000 && typeof record.motion === 'boolean';
}

// Runs in a tiny classic head script, before either document can paint.
// Links remain native: no fetch router, navigation delay or blocking overlay.
export function installPageTransitions(initialMotion = true) {
  restoreAtmosphere();
  window.addEventListener('pageshow', event => { if (event.persisted) restoreAtmosphere(); });
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let arrival, activeTransition, firstReveal = true;
  try {
    const raw = sessionStorage.getItem(ARRIVAL_KEY);
    sessionStorage.removeItem(ARRIVAL_KEY);
    const record = JSON.parse(raw);
    if (validArrival(record, location.pathname + location.search + location.hash, Date.now())) arrival = record;
  } catch { /* Storage is optional; native navigation must always work. */ }
  let simple = false;
  try {
    simple = location.pathname === '/map/'
      ? localStorage.getItem('aroha-map-view') === 'reading'
      : false;
  } catch { /* Private browsing can deny persistent preferences. */ }
  const disabled = !initialMotion || simple || reduced.matches ||
    new URLSearchParams(location.search).has('preview') ||
    new URLSearchParams(location.search).get('view') === 'reading' || arrival?.motion === false;
  html.dataset.routeMotion = disabled ? 'off' : 'on';
  html.dataset.routeArrivalMotion = arrival?.motion === false ? 'off' : 'on';
  // Same-origin referrer is a no-storage fallback for the welcome only.
  if (arrival || publicDestination(location.href, document.referrer)) html.dataset.routeArrival = 'true';
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') ||
      (link.target && link.target !== '_self')) return;
    const to = publicDestination(link.href, location.href);
    if (!to) return;
    const motion = event.detail > 0 && html.dataset.routeMotion !== 'off' && !reduced.matches;
    html.dataset.routeMotion = motion ? 'on' : 'off';
    try {
      sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify({
        to: to.pathname + to.search + to.hash, at: Date.now(), motion,
      }));
    } catch { /* Do not prevent the link when storage is unavailable. */ }
  }, { capture: true });
  // A visitor can interrupt the reveal immediately to use the new page.
  for (const type of ['pointerdown', 'keydown'])
    window.addEventListener(type, () => {
      html.dataset.motionInput = type === 'keydown' ? 'keyboard' : 'pointer';
      activeTransition?.skipTransition();
    }, { capture: true });
  window.addEventListener('pageswap', (event) => {
    if (reduced.matches || html.dataset.routeMotion === 'off') event.viewTransition?.skipTransition();
  });
  window.addEventListener('pagereveal', (event) => {
    // Position a fresh cross-page deep link before the browser takes its snapshot.
    // A restored history entry keeps the browser's saved scroll position.
    if (firstReveal && arrival && location.hash) {
      try { document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({behavior: 'instant'}); } catch { /* Malformed fragments stay native. */ }
    }
    firstReveal = false;
    if (!event.viewTransition) return;
    html.dataset.routeArrival = 'true';
    window.dispatchEvent(new Event('aroha:route-arrival'));
    if (reduced.matches || html.dataset.routeMotion === 'off' || html.dataset.routeArrivalMotion === 'off') {
      event.viewTransition.skipTransition();
      html.dataset.routeTransition = 'skipped';
      return;
    }
    activeTransition = event.viewTransition;
    html.dataset.routeTransition = 'active';
    event.viewTransition.ready.catch(() => {});
    event.viewTransition.finished.then(() => {
      if (activeTransition === event.viewTransition) activeTransition = null;
      html.dataset.routeTransition = 'complete';
    });
  });
}
