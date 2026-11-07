// Use an explicitly configured public origin when TLS terminates at a proxy.
// Forwarded headers are request input, not authority for our allowed origin.
export function requestSecurity(publicOrigin) {
  let configuredOrigin;
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a path or credentials.');
    }
    configuredOrigin = url.origin;
  }
  return {
    acceptsOrigin(req) {
      const expected = configuredOrigin || `http${req.socket.encrypted ? 's' : ''}://${req.headers.host}`;
      return !req.headers.origin || req.headers.origin === expected;
    },
    secureCookie(req) {
      return configuredOrigin?.startsWith('https://') || Boolean(req.socket.encrypted) || process.env.COOKIE_SECURE === 'true';
    }
  };
}
