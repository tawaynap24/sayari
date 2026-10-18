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

Header แสดงสมาชิกที่ login และผู้ใช้ออนไลน์ทั้งหมด พร้อมนับหลายแท็บ/หลายอุปกรณ์ตาม [วิธีนับและการตั้งค่า Presence](ONLINE_PRESENCE_TH.md)

จดจำ login 3 วันแบบต่ออายุเมื่อกลับมาใช้งาน รวมการคืนค่าหลังปิดเบราว์เซอร์ ดู [Session และผลทดสอบ](SESSION_TH.md)

ความสนใจนับแยกตามหัวข้อและหมดอายุเมื่อไม่ได้เปิดหัวข้อนั้น 7 วัน ต้องยืนยันสนใจใหม่เมื่อหมดอายุ ยอดผู้สนใจอัปเดตตามรายการที่ถูกถอดออก ดู [เงื่อนไข Activity และการตั้งค่างานหมดอายุ](INTEREST_ACTIVITY_TH.md)

ฟอร์มเรื่องราวไม่ปิดเมื่อยกเลิกเลือกไฟล์ และกู้คืน draft ข้อความ/ไฟล์จากเบราว์เซอร์หลังรีเฟรชหรือออกจากหน้าโดยไม่กดปิด รองรับอัปโหลดภาพและ PDF ดู [Draft และการอัปโหลดต่อ](DRAFTS_TH.md)

หน้าแรกแสดงเกม 5 รายการพร้อม [ภาพและข้อมูลแพตช์จากประกาศทางการที่อัปเดตอัตโนมัติ](GAME_COVERS_TH.md) แสดง 2 รายการต่อแถวเมื่อ viewport ตั้งแต่ 1200px และ 1 รายการต่อแถวเมื่อเล็กกว่า พื้นหลังตามธีม ยอดผู้สนใจแบบ realtime และเวลา Timeline ที่เปลี่ยนเฉพาะเมื่อข้อมูลเผยแพร่/แก้ไข/ซ่อนจริง ไม่มีตัวกรองหรือการสร้างหมวดหมู่เพิ่ม

## ตรวจสอบ

```powershell
npm run check
npm run test:emulators
```

`check` รัน production build, lint และ unit tests คำสั่ง `test:emulators` เริ่ม Emulator รันทดสอบ integration แล้วปิดให้ จึงใช้เมื่อยังไม่มี Emulator เปิดอยู่ ถ้าเปิดไว้แล้วให้ใช้ `npm run test:integration`

`npm run test:browser` ต้องมี dev server, Emulator และหัวข้อจาก `seed` ใช้ Edge ผ่าน Playwright ในโปรเจกต์นี้โดยตรง ผลอยู่ใน `evidence/timeline/` การทดสอบสร้างข้อมูลสังเคราะห์ใน Emulator

Integration และ browser tests ล้างหัวข้อสังเคราะห์ของรอบตัวเอง รวมเรื่องราว คำขอ สื่อ และข้อมูลติดตามที่เกี่ยวข้องใน `finally` แม้ทดสอบไม่ผ่าน จึงไม่ทิ้งรายการ “หัวข้อทดสอบ” ไว้บนหน้าเลือกหมวดหมู่ หากเคยหยุด process กลางคัน ใช้ `node tools/timeline/cleanup-fixtures.mjs` เพื่อตรวจรายการค้าง และเติม `--execute` เพื่อล้างเฉพาะ fixture ที่ตรงทั้ง ID และ metadata ของชุดทดสอบ คำสั่งนี้รองรับเฉพาะ Emulator `demo-timeline` ในเครื่อง ไม่แก้ไขหัวข้อที่ seed หรือข้อมูลเว็บไซต์จริง

ทดสอบการล้าง fixture ด้วย `npm run test:fixtures` ตรวจการ์ด 5 เกมและภาพสดด้วย `npm run test:games:browser` ตรวจ Login/สมัครสมาชิกด้วย `npm run test:login-memory:browser` และตรวจการเปลี่ยนภาพตาม API ด้วย `npm run test:game-covers` หลังเปิด Emulator และ seed

Emulator worker ตรวจคำขอหมดอายุทุก 5 นาที ข้อมูลทดสอบเป็นข้อมูลชั่วคราวก่อนปิดควร export หากต้องการเก็บไว้ การตั้งค่าบริการจริงดู [FIREBASE_SETUP_TH.md](FIREBASE_SETUP_TH.md)
