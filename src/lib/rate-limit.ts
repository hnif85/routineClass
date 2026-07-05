/**
 * Simple in-memory rate limiter.
 * For production (Vercel/serverless), replace with @upstash/ratelimit or similar.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000).unref();

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window in milliseconds */
  windowMs: number;
  /** Identifier (e.g. IP, user ID) */
  identifier: string;
}

export function checkRateLimit(config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const key = config.identifier;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // First request or window expired — create new entry
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + config.windowMs };
    store.set(key, newEntry);
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: newEntry.resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/** Extract client IP from NextRequest headers */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}

/** Preset limits */
export const LIMITS = {
  login: { maxRequests: 10, windowMs: 15 * 60 * 1000 },       // 10 / 15 min
  register: { maxRequests: 5, windowMs: 60 * 60 * 1000 },      // 5 / hour
  ai: { maxRequests: 20, windowMs: 60 * 60 * 1000 },           // 20 / hour
} as const;
