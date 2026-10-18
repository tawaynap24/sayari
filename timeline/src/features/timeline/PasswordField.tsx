import { useState } from "react";

export default function PasswordField({ id, name, label, autoComplete }: {
  id: string; name: string; label: string; autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="tl-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="tl-password-control">
        <input id={id} name={name} type={visible ? "text" : "password"} required minLength={6} autoComplete={autoComplete} />
        <button type="button" className="tl-password-toggle" aria-label={visible ? `ซ่อน${label}` : `แสดง${label}`}
          aria-controls={id} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
    </div>
  );
}
