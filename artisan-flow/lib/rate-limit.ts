type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalRateLimitStore = globalThis as unknown as {
  rateLimitStore?: Map<string, RateLimitEntry>;
};

const store = globalRateLimitStore.rateLimitStore ?? new Map<string, RateLimitEntry>();

if (!globalRateLimitStore.rateLimitStore) {
  globalRateLimitStore.rateLimitStore = store;
}

const cleanupExpiredEntries = (now: number) => {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
};

const getIpFromRequest = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
};

export const enforceRateLimit = (
  request: Request,
  scope: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } => {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const ip = getIpFromRequest(request);
  const key = `${scope}:${ip}`;
  const currentEntry = store.get(key);

  if (!currentEntry || currentEntry.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  if (currentEntry.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((currentEntry.resetAt - now) / 1000)),
    };
  }

  currentEntry.count += 1;
  store.set(key, currentEntry);

  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((currentEntry.resetAt - now) / 1000)),
  };
};
