export const INTEREST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const INTEREST_REFRESH_MS = 5 * 60 * 1000;

export interface Interest {
  uid: string;
  followedAt: number;
  lastActiveAt?: number;
  expiresAt?: number;
}

export function interestIsCurrent(interest: Pick<Interest, "expiresAt"> | null | undefined, now: number): boolean {
  if (!interest) return false;
  // Existing memberships receive a full seven-day grace period when migrated.
  // New memberships always have a server-issued deadline.
  if (interest.expiresAt === undefined) return true;
  return Number.isSafeInteger(interest.expiresAt) && interest.expiresAt > now;
}

export function interestActivity(now: number) {
  return { lastActiveAt: now, expiresAt: now + INTEREST_MAX_AGE_MS };
}
