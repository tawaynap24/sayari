import type { Kind, Choice } from "./types";
export const HOUR = 3_600_000;
export function count(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError("จำนวนต้องเป็นจำนวนเต็มที่ไม่ติดลบ");
  return n;
}
export function requiredVotes(kind: Kind, n: number): number | null {
  count(n);
  if (kind === "CREATE" && n < 50) return null;
  return Math.min(
    100,
    kind === "CREATE" ? Math.ceil(n / 10) : Math.max(5, Math.ceil(n / 10)),
  );
}
export function expiry(
  kind: Kind,
  submitted: number,
  changed = submitted,
): number {
  count(submitted);
  count(changed);
  if (changed < submitted)
    throw new RangeError("เวลาเปลี่ยนคะแนนก่อนเวลาส่งคำขอ");
  return kind === "CREATE"
    ? Math.max(submitted + 72 * HOUR, changed + 24 * HOUR)
    : changed + 24 * HOUR;
}
export function outcome(
  yes: number,
  no: number,
  target: number,
): "approved" | "rejected" | "pending" {
  count(yes);
  count(no);
  count(target);
  if (!target) throw new RangeError("เกณฑ์คะแนนต้องมากกว่าศูนย์");
  return yes >= target ? "approved" : no >= target ? "rejected" : "pending";
}
export function voteDelta(
  yesCount: number,
  noCount: number,
  old: Choice | null,
  next: Choice,
) {
  count(yesCount);
  count(noCount);
  if (old === next) return { yesCount, noCount, changed: false };
  return {
    yesCount: count(yesCount - Number(old === "yes") + Number(next === "yes")),
    noCount: count(noCount - Number(old === "no") + Number(next === "no")),
    changed: true,
  };
}
