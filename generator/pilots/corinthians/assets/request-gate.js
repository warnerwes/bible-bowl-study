// A late request may never write into a new account or superseding request.
export function createRequestGate(timeoutMs = 10000) {
  let active = null;
  function invalidate() {
    if (!active) return;
    clearTimeout(active.timer);
    active.controller.abort();
    active = null;
  }
  return {
    invalidate,
    begin() {
      invalidate();
      const request = { controller: new AbortController(), timer: null };
      active = request;
      request.timer = setTimeout(() => request.controller.abort(), timeoutMs);
      return {
        signal: request.controller.signal,
        owns: () => active === request,
        current: () => active === request && !request.controller.signal.aborted,
        finish() { clearTimeout(request.timer); if (active === request) active = null; },
      };
    },
  };
}
