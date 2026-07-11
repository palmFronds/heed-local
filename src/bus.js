// Private module-scoped event bus. Never bind to any host-page global object
// — that would let host-page scripts observe internal signal:*/inference:*
// traffic via addEventListener (see 01-RESEARCH.md Pattern 2 / Pitfall 2).
const target = new EventTarget();

/**
 * Publish a payload on the bus. This is the sole place in the codebase that
 * constructs a CustomEvent — the payload MUST be wrapped in { detail },
 * otherwise subscribers silently receive undefined (Pitfall 3).
 * @param {string} type
 * @param {*} detail
 */
export function publish(type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * Subscribe to a bus event type. Returns an unsubscribe function.
 * @param {string} type
 * @param {(detail: *) => void} handler
 * @returns {() => void}
 */
export function subscribe(type, handler) {
  const wrapped = (e) => handler(e.detail);
  target.addEventListener(type, wrapped);
  return () => target.removeEventListener(type, wrapped);
}
