# Timeline

ระบบเรื่องราวของชุมชนที่ใช้ React, Firebase Authentication, Firestore, Storage และ Cloud Functions มี Timeline Engine, การติดตามหัวข้อ, การเสนอ/แก้ไข/ซ่อนเรื่องราว, การโหวต, ประวัติ revision, แหล่งอ้างอิง และสื่อ

ติดตั้งและทำงานจากโฟลเดอร์นี้ได้โดยอิสระ ใช้ Node.js 22 และ Java 17 กับ Firebase CLI 14.22.0 ที่ล็อกในโปรเจกต์

`yaml` ระบุเป็น devDependency โดยตรงเพื่อรองรับ `@apphosting/build` ของ Firebase CLI รุ่นนี้ ซึ่งเรียกใช้แพ็กเกจแต่ไม่ได้ประกาศ dependency ของตัวเอง ใช้เวอร์ชันเดียวกับที่ CLI ใช้อยู่ใน lockfile

```powershell
npm ci
npm --prefix functions ci
npm run build:emulator
npm run emulators
```

รอ Emulator พร้อม เปิดอีก terminal ในโฟลเดอร์เดียวกัน:

```powershell
npm run seed
npm run dev
```

เว็บ: http://127.0.0.1:5174 · Hosting Emulator: http://127.0.0.1:5000 · Emulator UI: http://127.0.0.1:4000

โปรเจกต์ทดสอบใช้ `demo-timeline` เท่านั้น dev server ใช้ `.env.emulator` ส่วน `npm run build` ใช้ configuration ของบริการจริงจาก `.env.local` หากยังไม่ได้ตั้งค่าจะแสดงหน้ารอเชื่อมต่อฐานข้อมูล

## ตรวจสอบ

```powershell
npm run check
npm run test:emulators
```

`check` รัน production build, lint และ unit tests คำสั่ง `test:emulators` เริ่ม Emulator รันทดสอบ integration แล้วปิดให้ จึงใช้เมื่อยังไม่มี Emulator เปิดอยู่ ถ้าเปิดไว้แล้วให้ใช้ `npm run test:integration`

`npm run test:browser` ต้องมี dev server, Emulator และหัวข้อจาก `seed` ใช้ Edge ผ่าน Playwright ในโปรเจกต์นี้โดยตรง ผลอยู่ใน `evidence/timeline/` การทดสอบสร้างข้อมูลสังเคราะห์ใน Emulator

Emulator worker ตรวจคำขอหมดอายุทุก 5 นาที ข้อมูลทดสอบเป็นข้อมูลชั่วคราวก่อนปิดควร export หากต้องการเก็บไว้ การตั้งค่าบริการจริงดู [FIREBASE_SETUP_TH.md](FIREBASE_SETUP_TH.md)
