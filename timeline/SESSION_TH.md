# จดจำการเข้าสู่ระบบ 3 วันแบบต่ออายุ

## อีเมลล่าสุดและรหัสผ่าน

ช่องอีเมลเติมบัญชีที่เข้าสู่ระบบสำเร็จล่าสุดจาก `timeline.lastLoginEmail` แม้ออกจากระบบหรือปิด/เปิดเบราว์เซอร์ใหม่ การ login ไม่สำเร็จไม่เปลี่ยนค่าที่จำไว้ รหัสผ่านไม่ถูกเขียนลง localStorage/sessionStorage ของเว็บไซต์

ฟอร์มมี `username`, `current-password` และ `new-password` พร้อม ID/name คงที่ รองรับตัวจัดการรหัสผ่านของเบราว์เซอร์ และอ่านค่าจาก FormData เพื่อรับค่า autofill ที่อาจไม่มี React change event ผู้ใช้ต้องยอมบันทึกรหัสผ่านผ่านเบราว์เซอร์ครั้งแรกตามการตั้งค่าของตน

สมัครสมาชิกต้องยืนยันรหัสผ่านให้ตรงกัน ทุกช่องรหัสผ่านมีปุ่มแสดง/ซ่อน ปุ่มลืมรหัสผ่านและข้อความอธิบายในฟอร์มถูกซ่อนตามที่ขอ ข้อผิดพลาดกรณีไม่พบบัญชีหรือรหัสผ่านผิดแสดง “อีเมลหรือรหัสผ่านไม่ถูกต้อง” เหมือนกัน

เมื่อสมัครสำเร็จ Firebase จะเข้าสู่บัญชีใหม่ทันที ฟอร์มรอบันทึกชื่อและให้ session ของเว็บไซต์พร้อมก่อนปิด จากนั้น Header แสดงชื่อบัญชีและปุ่มออกจากระบบโดยไม่ต้องกรอก Login ซ้ำ ใช้การจดจำ 3 วันและต่ออายุเมื่อกลับมาใช้งานเช่นเดียวกับ Login ปกติ ไม่เก็บรหัสผ่านเพิ่ม

อ้างอิง [HTML autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)

## Session

Timeline จดจำ login ในเบราว์เซอร์เดิม และใช้ session แบบ **ไม่ได้ใช้งานครบ 3 วันจึงหมดอายุ** เมื่อกลับมาเปิดหน้าเว็บ รีโหลด หรือกลับมาใช้แท็บก่อนหมดอายุ backend จะขยับวันหมดอายุเป็นเวลาปัจจุบัน + 3 วัน

ตัวอย่าง: login วันจันทร์ เวลา 10:00 จะหมดอายุวันพฤหัส เวลา 10:00 หากกลับมาใช้วันพุธ เวลา 15:00 จะต่ออายุถึงวันเสาร์ เวลา 15:00 หากปล่อยให้หมดอายุแล้วต้องกรอกข้อมูล login ใหม่

## พฤติกรรม

- ใช้ Firebase `browserLocalPersistence` และรอคืนค่า Auth ให้เสร็จก่อนแสดงว่า login แล้ว ปิดเบราว์เซอร์แล้วเปิดใหม่ยังคืนค่าได้
- ต่ออายุเมื่อเปิดหน้า/รีโหลด, focus, กลับจาก background และ online อีกครั้ง การโต้ตอบในหน้าเว็บช่วยต่ออายุด้วย โดยจำกัดการส่งจาก pointer/keyboard ไม่เกินประมาณนาทีละครั้ง
- การ refresh Firebase token รายชั่วโมง และ heartbeat ของตัวนับออนไลน์ ไม่ต่ออายุ session เอง การเปิดแท็บทิ้งไว้โดยไม่ได้ใช้งานจึงไม่ยืดอายุไปเรื่อย ๆ
- แต่ละแท็บซิงก์วันหมดอายุและ logout ร่วมกัน เมื่อกดออกจากระบบจะล้างสถานะในแท็บอื่นของเบราว์เซอร์เดียวกันด้วย
- ครบ 3 วันโดยไม่ได้กลับมาใช้จะออกจากระบบอัตโนมัติ หากแท็บถูกพักหรือเครื่อง sleep จะตรวจซ้ำเมื่อกลับมาที่หน้าเว็บ
- เมื่อเน็ตขาดจะใช้วันหมดอายุที่บันทึกล่าสุดเพื่อคง UI ของบัญชีที่ยังไม่หมดอายุ แต่ไม่ต่อวันหมดอายุจากเครื่องเอง การต่ออายุต้องได้รับการยืนยันจาก backend

## ข้อมูลและการตรวจสิทธิ์

Firebase SDK จัดการ tokens และ persistence ไม่เก็บรหัสผ่านเอง คีย์ `timeline.session` เก็บเฉพาะ UID, เวลาของการ login และวันหมดอายุเพื่อช่วยคืนค่า UI แบบ offline

`timelineSession` รับเพียง `{ action: "renew" }` โดยใช้ UID และ `auth_time` จาก Firebase Auth token ที่ตรวจสอบแล้ว อ้างอิง record `users/{uid}/authSessions/{auth_time}` transaction จะต่ออายุได้เฉพาะ record ที่ยังไม่หมดอายุ หากเคยหมดอายุแล้ว token เดิมไม่สามารถสร้างวันหมดอายุใหม่ได้

สำหรับผู้ใช้เดิมที่ยังไม่มี record จะ bootstrap ได้เมื่อการ login นั้นมีอายุไม่เกิน 3 วัน การ login ใหม่ด้วย credentials จะมี `auth_time` ใหม่และเริ่ม session ใหม่ได้

Private APIs, การอัปโหลด Storage และ Firestore Rules ตรวจ expiry ของ record เดียวกันตามเวลาฝั่ง server การเปลี่ยนเวลาหรือค่า localStorage ฝั่ง browser ไม่ให้สิทธิ์ข้าม session ที่หมดอายุแล้ว Client อ่านได้เฉพาะ record ของ login ตัวเองและไม่มีสิทธิ์เขียน expiry โดยตรง

## การใช้งานและเผยแพร่

สถานะ browser แยกตาม origin: `localhost`, `127.0.0.1`, พอร์ตต่างกัน และโดเมนจริงถือเป็นคนละที่จัดเก็บ ควรใช้ URL เดิมเมื่อทดสอบการจดจำ login การล้างข้อมูลเว็บไซต์/private window หรือการ reset ข้อมูลบัญชีใน Emulator ย่อมทำให้คืนค่าบัญชีเดิมไม่ได้

ต้องเผยแพร่ frontend, Functions ใหม่ `timelineSession`, API guards, Firestore Rules และ Storage Rules ชุดนี้ร่วมกัน ยังไม่มีการ deploy cloud อัตโนมัติ ใช้ Firebase services และ Auth provider เดิม ไม่ต้องเปิด provider ใหม่

อ้างอิง: [Firebase Auth persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence), [Firebase sessions และ token refresh](https://firebase.google.com/docs/auth/admin/manage-sessions)

## ผลตรวจ

- Unit suite: 59 tests ผ่าน
- Session integration: 5 กรณีผ่าน รวมต่ออายุข้ามอายุ login เดิม, วันหมดอายุแบบ exact boundary, ปฏิเสธ token เดิมหลังหมดอายุ, Firestore/Storage และ HTTP callable จริง
- Browser: 7 กรณีผ่าน รวม reload, ปิด/เปิด browser profile จริง, หลายแท็บ, ต่ออายุเมื่อกลับมา, token refresh ไม่ต่ออายุเอง และ logout ทุกแท็บ
- V5 integration เดิม: 23 กรณีผ่าน
- Presence integration เดิม: 9 กรณีผ่าน

```powershell
npm test
node tools/timeline/session-integration.mjs
node tools/timeline/session-browser.mjs
npm run build:emulator
npm run lint
```

Integration และ browser ต้องเปิด Firebase Emulator ไว้ก่อน Browser ใช้ Edge และ Vite พอร์ต 5174 หลักฐานชุดใหม่อยู่ `evidence/timeline/session-integration.json` และ `session-browser.json`
