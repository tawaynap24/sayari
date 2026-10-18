# ผู้ใช้ออนไลน์ใน Header

ด้านซ้ายของ Header แสดง **เข้าสู่ระบบ** และ **ออนไลน์ทั้งหมด** ของเว็บไซต์ Timeline เท่านั้น ยอดรวมเป็นผู้ที่ยังใช้งานอยู่ รวมสมาชิกและผู้เยี่ยมชม ไม่ใช่ยอดสะสมหรือจำนวนบัญชีที่สมัครทั้งหมด

## วิธีนับ

- สมาชิก: นับ UID ที่ backend ตรวจสอบจาก Firebase Auth หนึ่งบัญชีเปิดหลายแท็บหรือหลายเบราว์เซอร์นับหนึ่งคน
- ผู้เยี่ยมชม: ใช้รหัสสุ่มใน localStorage คีย์ `timeline.visitor` หนึ่งเบราว์เซอร์เปิดหลายแท็บนับหนึ่งคน เมื่อ login จะไม่นับสถานะ guest เดิมของเบราว์เซอร์นั้นซ้ำ
- แท็บส่ง heartbeat ทุก 30 วินาที พร้อมลำดับคำขอ และส่ง leave ด้วย keepalive เมื่อปิดหน้าเว็บหรือออกจาก session
- หากส่ง leave ไม่สำเร็จ เช่น เครื่องดับหรืออินเทอร์เน็ตหลุด lease หมดอายุใน 120 วินาที และ job ตรวจทุกนาที จึงอาจค้างได้ประมาณ 2–3 นาที ไม่มีการอ้างว่าเป็นการตรวจ disconnect แบบทันที
- เมื่อ browser offline, ยังโหลดข้อมูล หรือ Firebase ใช้งานไม่ได้ แสดง `—` แทนการแสดงตัวเลขที่อาจเก่าเป็นยอดปัจจุบัน
- สถานะใน background อาจหมดอายุเมื่อระบบปฏิบัติการพักแท็บ และจะกลับมานับเมื่อเปิดใช้งานอีกครั้ง ผู้เยี่ยมชมที่ล้าง storage หรือเปิด private context ถูกมองเป็นอีกเบราว์เซอร์ ตัวเลขจึงเป็นจำนวนบัญชี/เบราว์เซอร์ตามนิยามข้างต้น ไม่สามารถยืนยันจำนวนบุคคลทางกายภาพได้

## Backend และข้อมูล

`timelinePresence` เป็น callable ที่รับเฉพาะ visitor key, connection ID, sequence และ action ค่า UID/จำนวนผู้ใช้จาก client ไม่ถูกยอมรับ callable ใช้ Auth token ที่ตรวจสอบแล้ว และใช้ App Check ตาม `TIMELINE_ENFORCE_APP_CHECK` เช่นเดียวกับ API หลัก

Firestore transaction ปรับ contribution ของเบราว์เซอร์และบัญชี พร้อม aggregate แบบ atomic รองรับคำขอซ้ำ ลำดับ leave มาก่อน heartbeat และ concurrent arrivals โดยไม่สแกนผู้ใช้ทั้งหมดทุก heartbeat

- `siteStats/online`: ยอด `signedIn`, `total` และเวลาอัปเดต อ่านได้เฉพาะ document นี้สำหรับแสดงผลสาธารณะ
- `presenceVisitors`: connections ส่วนตัวและเวลาหมดอายุ
- `presencePeople`: leases ที่ใช้รวมหลายเบราว์เซอร์ของบัญชีเดียวกัน

Client อ่านรายการ visitor/person และเขียน counter โดยตรงไม่ได้ ไม่เผยแพร่ UID, ชื่อ, email, IP หรือ visitor key ให้ผู้ชมคนอื่น ทะเบียนหมดอายุถูกล้างทีละไม่เกิน 100 browser records ต่อรอบ และเมื่อมี heartbeat ใหม่ จะช่วยล้างรายการหมดอายุด้วย

Firestore ไม่มี presence แบบ native จึงใช้ lease ของ backend ในชุดนี้ ดู [แนวทาง presence ของ Firebase](https://firebase.google.com/docs/firestore/solutions/presence) ส่วน Auth/App Check ของ callable อ้างอิง [callable functions](https://firebase.google.com/docs/functions/callable) และ [HTTP protocol](https://firebase.google.com/docs/functions/callable-reference)

## การเปิดใช้งานจริง

ใช้ Firestore/Functions เดิม ไม่ต้องเปิด Realtime Database หรือ Anonymous Auth เพิ่ม ต้อง deploy frontend, Functions (`timelinePresence`, `expireTimelinePresence`), Firestore Rules และ index field overrides ด้วยตนเองตาม workflow ของโปรเจกต์ Scheduled job บน cloud ต้องมี Billing/IAM/Scheduler พร้อมตามคู่มือ Firebase เดิม

ใน Emulator ใช้ `npm run emulators` ตามปกติ worker ใน `tools/timeline/sweep.mjs` ตรวจ presence ทุก 30 วินาที โดยงานหมดอายุคำขอ/สื่อยังรันทุก 5 นาที

## ตรวจสอบ

```powershell
npm test
npm run test:presence
node tools/timeline/presence-browser.mjs
npm run build:emulator
npm run lint
```

`test:presence` และ `presence-browser.mjs` ต้องเปิด Emulator ไว้ก่อน Browser test ใช้ Edge และ Vite พอร์ต 5174 หรือเปลี่ยน `TIMELINE_TEST_ORIGIN` เป็น Hosting Emulator 5000 หลักฐานอยู่ `evidence/timeline/presence-integration.json` และ `presence-browser.json`
