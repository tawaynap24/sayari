const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
/** A Gregorian date and 24-hour Thai local time, independent of the browser locale. */
export function formatTimelineDate(timestamp: number): string {
  const values = Object.fromEntries(parts.formatToParts(timestamp).map(p => [p.type, p.value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute} น.`;
}
