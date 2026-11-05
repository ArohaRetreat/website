// Keep one guest destination across the public website, enquiries and booking.
export function finishGuestSignIn({navigate = path => window.location.assign(path), storage} = {}) {
  try { (storage || window.sessionStorage).setItem('aroha-guest-session','1'); } catch {}
  navigate('/');
  return {redirecting:true};
}
