/**
 * Per-socket, per-event sabit-pencere rate limit.
 * Soket tek bir instance'a pinli olduğu için RAM'de tutmak yeterli (Redis round-trip'i gereksiz).
 * Her bağlantı için ayrı bir limiter örneği oluşturulur → soket kapanınca state GC'lenir.
 */
function createRateLimiter(limits) {
  const state = new Map(); // event -> { count, resetAt }
  return function allow(event) {
    const cfg = limits[event] || limits.default;
    if (!cfg) return true;
    const now = Date.now();
    let s = state.get(event);
    if (!s || now >= s.resetAt) {
      s = { count: 0, resetAt: now + cfg.windowMs };
      state.set(event, s);
    }
    s.count += 1;
    return s.count <= cfg.max;
  };
}

module.exports = { createRateLimiter };
