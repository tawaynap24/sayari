const EMAIL_KEY = "timeline.lastLoginEmail";

export function lastLoginEmail(): string {
  try { return localStorage.getItem(EMAIL_KEY) || ""; }
  catch { return ""; }
}

export function rememberLoginEmail(email: string | null) {
  if (!email) return;
  try { localStorage.setItem(EMAIL_KEY, email.trim()); }
  catch { /* Login still works when browser storage is unavailable. */ }
}
