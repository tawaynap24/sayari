/**
 * SAYARI Timeline V5 — reference pure domain policy, not a deployed backend.
 * Codex must adapt to project's TypeScript rules and test independently.
 * All backend decisions must use trusted server time/counters/UID.
 */
export type TimelineRequestKind = 'CREATE' | 'EDIT' | 'HIDE';
export type TimelineVoteChoice = 'yes' | 'no';
export type TimelineRequestOutcome = 'pending' | 'approved' | 'rejected';

export const CREATE_VOTING_MIN_INTEREST = 50;
export const MAX_REQUIRED_VOTES = 100;
export const EDIT_HIDE_MIN_REQUIRED_VOTES = 5;
export const HOUR_MS = 60 * 60 * 1000;

function assertInterestCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('interestCount must be a nonnegative safe integer');
  }
}
function assertTimestamp(ts: number): void {
  if (!Number.isSafeInteger(ts) || ts < 0) {
    throw new RangeError('time must be trusted epoch milliseconds');
  }
}

/** null means CREATE must publish immediately, no request/voting. */
export function requiredVotes(kind: TimelineRequestKind, interestCount: number): number | null {
  assertInterestCount(interestCount);
  if (kind === 'CREATE' && interestCount < CREATE_VOTING_MIN_INTEREST) {
    return null;
  }
  const byInterest = Math.ceil(interestCount / 10);
  return Math.min(
    MAX_REQUIRED_VOTES,
    kind === 'CREATE' ? byInterest : Math.max(EDIT_HIDE_MIN_REQUIRED_VOTES, byInterest),
  );
}

/** submittedAt and lastVoteChangedAt are UTC epoch milliseconds from server. */
export function calculateExpiryMs(
  kind: TimelineRequestKind,
  submittedAt: number,
  lastVoteChangedAt: number = submittedAt,
): number {
  assertTimestamp(submittedAt);
  assertTimestamp(lastVoteChangedAt);
  if (lastVoteChangedAt < submittedAt) {
    throw new RangeError('lastVoteChangedAt cannot precede submission');
  }
  const inactivityExpiry = lastVoteChangedAt + 24 * HOUR_MS;
  return kind === 'CREATE'
    ? Math.max(submittedAt + 72 * HOUR_MS, inactivityExpiry)
    : inactivityExpiry;
}

/** yes branch before no = approve requested action on theoretical tie. */
export function decideOutcome(
  yesCount: number,
  noCount: number,
  target: number,
): TimelineRequestOutcome {
  for (const n of [yesCount, noCount, target]) {
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('invalid vote counts');
  }
  if (target === 0) throw new RangeError('auto-publish must not create vote request');
  if (yesCount >= target) return 'approved';
  if (noCount >= target) return 'rejected';
  return 'pending';
}

/** Updates are effective only when the new choice differs from the saved one. */
export function applyVoteDelta(
  yesCount: number,
  noCount: number,
  oldChoice: TimelineVoteChoice | null,
  nextChoice: TimelineVoteChoice,
): { yesCount: number; noCount: number; changed: boolean } {
  if (!Number.isSafeInteger(yesCount) || !Number.isSafeInteger(noCount) || yesCount < 0 || noCount < 0) {
    throw new RangeError('invalid counts');
  }
  if (oldChoice === nextChoice) return { yesCount, noCount, changed: false };
  const yesNext = yesCount - (oldChoice === 'yes' ? 1 : 0) + (nextChoice === 'yes' ? 1 : 0);
  const noNext = noCount - (oldChoice === 'no' ? 1 : 0) + (nextChoice === 'no' ? 1 : 0);
  if (yesNext < 0 || noNext < 0) throw new RangeError('vote counter underflow');
  return { yesCount: yesNext, noCount: noNext, changed: true };
}

/** A vote at the expiry timestamp must be denied before evaluating score. */
export function hasExpired(now: number, expiresAt: number): boolean {
  assertTimestamp(now);
  assertTimestamp(expiresAt);
  return now >= expiresAt;
}
