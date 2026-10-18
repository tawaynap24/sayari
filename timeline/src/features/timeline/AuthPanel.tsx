import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, errorText } from "./client";
import Modal from "./Modal";
export default function AuthPanel({ onClose }: { onClose: () => void }) {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={register ? "สร้างบัญชี Timeline" : "เข้าสู่ระบบ"}
      onClose={onClose}
    >
      <form
        className="tl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (register) {
              const c = await createUserWithEmailAndPassword(
                auth,
                email,
                password,
              );
              await updateProfile(c.user, { displayName: name.trim() });
              await c.user.getIdToken(true);
            } else await signInWithEmailAndPassword(auth, email, password);
            onClose();
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="tl-muted">เข้าร่วมเขียนเรื่องราวและพิจารณาคำขอของชุมชน</p>
        {register && (
          <label>
            ชื่อที่แสดงต่อสาธารณะ
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          อีเมล
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          รหัสผ่าน
          <input
            type="password"
            minLength={6}
            required
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="tl-error">
            {error}
          </p>
        )}
        <button className="tl-primary" disabled={busy}>
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
        {!register && (
          <button
            type="button"
            disabled={!email || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await sendPasswordResetEmail(auth, email);
                setError("หากอีเมลนี้มีบัญชี ระบบจะส่งวิธีตั้งรหัสผ่านใหม่");
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            ลืมรหัสผ่าน
          </button>
        )}
        {register && (
          <small>
            ชื่อและเรื่องราวที่เผยแพร่เป็นข้อมูลสาธารณะ
            กรุณาไม่ใส่ข้อมูลส่วนบุคคลของผู้อื่น การสมัครยังไม่บังคับยืนยันอีเมล
          </small>
        )}
      </form>
    </Modal>
  );
}
