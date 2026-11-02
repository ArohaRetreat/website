export const monitoringUserTag = (user) =>
  typeof user?.uid === "string" && /^[A-Za-z0-9:_-]{1,128}$/.test(user.uid)
    ? `firebase:${user.uid}`
    : "";
export function createRumIdentity({
  agent = () =>
    window.dynatrace?.identifyUser ? window.dynatrace : window.dtrum,
  consented = () => false,
  schedule = (fn) => setTimeout(fn, 500),
  cancel = clearTimeout,
} = {}) {
  let uid = "",
    timer,
    generation = 0,
    disposed = false;
  function sync() {
    const request = ++generation;
    cancel(timer);
    let attempts = 0;
    function apply() {
      if (disposed || request !== generation || !consented()) return;
      try {
        const a = agent();
        if (typeof a?.identifyUser === "function") {
          a.identifyUser(uid);
          return;
        }
      } catch {}
      if (++attempts < 20) timer = schedule(apply);
    }
    apply();
  }
  return {
    setUser(user) {
      uid = monitoringUserTag(user);
      sync();
    },
    sync,
    withdraw() {
      generation++;
      cancel(timer);
      try {
        agent()?.identifyUser?.("");
      } catch {}
    },
    suspend() {
      generation++;
      cancel(timer);
    },
    destroy() {
      disposed = true;
      generation++;
      cancel(timer);
    },
  };
}
