export const SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
export const SESSION_CLOCK_SKEW_MS = 60_000;

export function sessionDeadline(authTime: unknown): number | null {
  if (typeof authTime !== "number" || !Number.isSafeInteger(authTime) || authTime < 0) return null;
  const deadline = authTime * 1000 + SESSION_MAX_AGE_MS;
  return Number.isSafeInteger(deadline) ? deadline : null;
}

export function sessionIsCurrent(authTime: unknown, now = Date.now()): boolean {
  const deadline = sessionDeadline(authTime);
  return deadline !== null && deadline - SESSION_MAX_AGE_MS <= now + SESSION_CLOCK_SKEW_MS && now < deadline;
}
