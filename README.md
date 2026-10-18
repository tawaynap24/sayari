# Sayari Project

โฟลเดอร์หลักและ Git repository สำหรับสองโปรเจกต์อิสระ ไม่มีเว็บหรือ Firebase configuration ที่ root

```text
sayari-project/
  zzz/       # Calculator, Database, Nanoka และภาษาไทย
  timeline/  # Timeline frontend, backend และ Firebase ทั้งหมด
  docs/      # เอกสารประวัติและรายงานการแยกโปรเจกต์
  evidence/  # หลักฐานเดิมและการตรวจความครบถ้วนหลังย้าย
  _handoff/  # Specification ต้นฉบับ
```

แต่ละโปรเจกต์มี `package.json`, lockfile, dependencies, source และ build output ของตัวเอง ติดตั้งโดยใช้ `npm ci` ภายในแต่ละโฟลเดอร์ และ `npm --prefix functions ci` ภายใน Timeline

จาก root ใช้ `npm run dev:zzz` เพื่อเปิด http://127.0.0.1:5173 และ `npm run dev:timeline` เพื่อเปิด http://127.0.0.1:5174 โดย Timeline ต้องเปิด Emulator ด้วย ดู [คู่มือ ZZZ](zzz/README.md) และ [คู่มือ Timeline](timeline/README.md)

Firebase project เดิม `sayari-81b58` ใช้สำหรับ Timeline เท่านั้นในโครงสร้างใหม่ ZZZ ไม่มี SDK หรือการเชื่อมต่อ Firebase ส่วนการตั้งค่าบริการจริงและการเปลี่ยนเว็บไซต์ที่เผยแพร่ต้องดำเนินการแยก ดู [ขั้นตอน Firebase](timeline/FIREBASE_SETUP_TH.md)

คำสั่งรวม: `npm run build`, `npm run lint`, `npm test` และ `npm run test:split` เอกสารสรุปปัจจุบันอยู่ [PROJECT_SPLIT_REPORT_TH.md](docs/PROJECT_SPLIT_REPORT_TH.md) รายงานเก่าและชุด handoff เก็บไว้เป็นประวัติ ไม่ใช่ตำแหน่ง source ปัจจุบัน

Git ยังเป็น repository เดิม `https://github.com/tawaynap24/sayari.git` และไม่ได้แยกเป็นสอง repositories ไม่มีการ commit, push หรือ deploy อัตโนมัติ
