# Zenless Zone Zero

โปรเจกต์อิสระสำหรับ Calculator, Database, Nanoka และข้อมูลภาษาไทย ใช้ React + Vite อ่าน JSON จาก `public/nanoka` และ `public/localization` รันได้โดยไม่ต้องมี backend, บัญชีผู้ใช้ หรือบริการฐานข้อมูล

## เริ่มใช้งาน

ใช้ Node.js 22 เปิด terminal ในโฟลเดอร์นี้:

```powershell
npm ci
npm run dev
```

เปิด http://127.0.0.1:5173 หน้าแรกมีเครื่องคำนวณและฐานข้อมูล เส้นทางเดิม `/game/zenless-zone-zero` และ `/game/zenless-zone-zero/database` ยังใช้ได้

```powershell
npm run build
npm run lint
npm test
npm run test:calculator
npm run test:browser
```

สองคำสั่ง browser ต้องเปิด dev server และมี Microsoft Edge อยู่ในเครื่อง Playwright เป็น devDependency ของโปรเจกต์นี้โดยตรง

## ข้อมูลและการเผยแพร่

`nanoka:sync` / `nanoka:export` อัปเดต snapshot; `localization:sync` อัปเดตคำแปล และ `localization:build` ใช้ cache แบบ offline ข้อมูลและสูตรเดิมถูกย้ายโดยเก็บ bytes ต้นฉบับ การตั้งค่าภาษาใช้ localStorage คีย์ `zzz.locale`; การเปิดครั้งแรกหลังเปลี่ยนชื่อคีย์จะกลับเป็นภาษาไทย

นำ `dist/` ไปใช้กับ static host ที่เลือกเอง ตั้ง SPA fallback เฉพาะหน้าเว็บ และให้ไฟล์ JSON ที่ไม่มีอยู่คืน 404 ตั้ง cache ของ `current.json` เป็น no-cache และ objects/snapshots ที่ใช้ content hash เป็น immutable

โปรเจกต์นี้ไม่มี SDK, credentials, deployment config หรือการเชื่อมต่อ Firebase
