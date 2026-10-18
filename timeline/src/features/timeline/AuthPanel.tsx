import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, authSession, errorText } from "./client";
import Modal from "./Modal";
import { lastLoginEmail, rememberLoginEmail } from "./loginMemory";
import PasswordField from "./PasswordField";
export default function AuthPanel({ onClose }: { onClose: () => void }) {
  const [savedEmail] = useState(lastLoginEmail);
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={register ? "สร้างบัญชี Timeline" : "เข้าสู่ระบบ"}
      onClose={onClose}
    >
      <form
        key={register ? "register" : "login"}
        id={register ? "timeline-register-form" : "timeline-login-form"}
        name={register ? "timeline-register" : "timeline-login"}
        action="/timeline"
        method="post"
        autoComplete="on"
        className="tl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          // Read the actual fields: password managers may fill inputs without
          // dispatching the change events used by React state.
          const fields = new FormData(e.currentTarget);
          const email = String(fields.get("username") || "").trim();
          const password = String(fields.get("password") || "");
          if (register && password !== String(fields.get("confirmPassword") || "")) {
            setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await authSession.ready;
            const c = register
              ? await createUserWithEmailAndPassword(auth, email, password)
              : await signInWithEmailAndPassword(auth, email, password);
            rememberLoginEmail(c.user.email);
            if (register) {
              await updateProfile(c.user, { displayName: String(fields.get("displayName") || "").trim() });
              await c.user.getIdToken(true);
            }
            await authSession.completeSignIn(c.user);
            onClose();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <label>
            ชื่อที่แสดงต่อสาธารณะ
            <input
              required
              name="displayName"
              maxLength={80}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          อีเมล
          <input
            type="email"
            id={register ? "timeline-register-email" : "timeline-login-email"}
            name="username"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={savedEmail}
          />
        </label>
        <PasswordField id={register ? "timeline-register-password" : "timeline-login-password"}
          name="password" label="รหัสผ่าน" autoComplete={register ? "new-password" : "current-password"} />
        {register && <PasswordField id="timeline-register-confirm-password" name="confirmPassword"
          label="ยืนยันรหัสผ่าน" autoComplete="new-password" />}
        {error && (
          <p role="alert" className="tl-error">
            {error}
          </p>
        )}
        <button type="submit" className="tl-primary" disabled={busy}>
          {busy ? "กำลังดำเนินการ…" : register ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "มีบัญชีแล้ว เข้าสู่ระบบ" : "ยังไม่มีบัญชี สมัครสมาชิก"}
        </button>
      </form>
    </Modal>
  );
}
