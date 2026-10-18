# การตั้งค่า Firebase สำหรับ Timeline

Firebase ทั้งหมดของ repository นี้อยู่ในโฟลเดอร์นี้: `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules` และ `functions/` ค่า default project ใน `.firebaserc` ชี้บริการเดิม รหัสนี้เป็น technical ID ของบริการ ไม่ใช่ชื่อที่แสดงในเว็บไซต์

Authentication เก็บบัญชีสมาชิก, Firestore เก็บหัวข้อ/เรื่องราว/revisions/คำขอ/คะแนน/สิทธิ์ติดตาม/audit, Storage เก็บสื่อ และ Functions ตรวจสิทธิ์และเขียนข้อมูลผ่าน transaction โดย client ไม่มีสิทธิ์เขียนข้อมูล authoritative โดยตรง Hosting ชี้ `dist/` ของ Timeline เท่านั้น

## ขั้นตอนของเจ้าของบริการก่อนใช้งานจริง

1. เปิด Firebase Console และเลือก project ให้ตรง `.firebaserc` เพิ่มหรือเลือก Web App สำหรับ Timeline ตั้งชื่อแสดงผลของแอปตามต้องการ
2. คัดลอก `.env.example` เป็น `.env.local` และใส่ public web config จริง โดยเฉพาะ API key, auth domain, app ID และ bucket ตาม Console ตั้ง `VITE_FIREBASE_EMULATORS=false` ห้ามใส่ service-account private key ใน frontend
3. เปิด Email/Password ใน Authentication และเพิ่มโดเมนของเว็บใน authorized domains ตรวจ default Firestore database และ Storage bucket ก่อนใช้งาน Functions ใช้ region `asia-southeast1`
4. ตรวจ Billing/Blaze, IAM และสิทธิ์เชื่อม Storage Rules กับ Firestore ตามข้อกำหนดของบริการ ตั้ง budget alerts ตามงบที่ต้องการ การทำงานในเครื่องยังไม่ได้เปิด Billing หรือแก้ Console
5. หากใช้ App Check ให้ตั้ง web site key ใน `VITE_FIREBASE_APPCHECK_SITE_KEY` และตั้ง `TIMELINE_ENFORCE_APP_CHECK=true` สำหรับ Functions เมื่อทดสอบ token ของเว็บจริงแล้ว
6. รัน `npm run build` และ `npm run build:functions` จากโฟลเดอร์นี้ ตรวจว่า build ใช้ configuration จริง จากนั้นเจ้าของบริการจึง deploy rules/indexes/functions/storage/hosting ด้วยตนเอง ตรวจสิทธิ์และรายการที่จะ deploy ก่อนยืนยัน
7. ตรวจ email login, deep links, voting, uploads/media access และ scheduled jobs บนบริการจริง ตั้ง moderator/seed หัวข้อด้วย private operator CLI ตามสิทธิ์ที่ได้รับ

การเปลี่ยน Hosting ไปชี้ Timeline จะเปลี่ยนเนื้อหาบนเว็บไซต์ที่บริการนั้นให้บริการอยู่ โปรดเลือกโดเมนหรือ site เป้าหมายก่อน deploy ข้อมูลเดิมใน cloud ไม่ถูกลบหรือย้ายโดยการเปลี่ยนโครงสร้างไฟล์ครั้งนี้ และเว็บไซต์ที่เผยแพร่เดิมยังไม่เปลี่ยนจนกว่าจะ deploy

## Operator CLI

`tools/timeline/admin.mjs` ต้องระบุ `--project ID` เสมอ ค่าเริ่มต้น dry run รองรับ `seed-topics`, `claim --uid UID`, `claim --uid UID --revoke` และ `restrict-story --story ID` ใช้ Application Default Credentials ของผู้ดูแล การเขียนจริงต้องเพิ่ม `--execute --reason "เหตุผล"` หาก bucket ไม่ใช่ค่า default ให้ระบุ `--bucket BUCKET` ด้วย

## Emulator

ใช้ project `demo-timeline` ที่พอร์ต Auth 9099, Firestore 8080, Functions 5001, Storage 9199, Hosting 5000 และ UI 4000 ไม่ใช้ credentials ของบริการจริง ชุดสำรองก่อนแยกโครงสร้างเก็บใน `.timeline/before-project-split/` ซึ่งไม่เข้า Git และไม่ได้ import ลง project ทดสอบใหม่อัตโนมัติ

ข้อมูล metadata หัวข้อเกมใน Timeline เป็นเนื้อหาของระบบเรื่องราว ไม่มีการเชื่อมต่อแอปหรือเครื่องคำนวณภายนอก
