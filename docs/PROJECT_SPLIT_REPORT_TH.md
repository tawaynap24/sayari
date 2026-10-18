# รายงานแยก ZZZ / Timeline และการจัดสรร Firebase

วันที่ 18 ตุลาคม 2026 — แยกโปรเจกต์และทดสอบในเครื่องเสร็จ

## ผลลัพธ์

`D:\sayari-project` เป็นโฟลเดอร์หลักของ Git repository เดิม ภายในมีแอปอิสระสองตัว:

- `zzz/`: React/Vite, Calculator, Database, Nanoka, Thai Localization และ JSON snapshots ไม่มี Firebase dependencies หรือ configuration
- `timeline/`: React/Vite, Timeline Engine, Authentication, Firestore, Voting, Media, Cloud Functions, Rules, Indexes, Emulator และเครื่องมือ operator

แต่ละแอปมี package.json, package-lock.json, node_modules, source, tests และ dist ของตัวเอง ไม่มีการ import runtime source จากอีกแอปหนึ่ง Root package เป็นเพียงคำสั่งเรียกแต่ละแอป ไม่มี dependencies และไม่ได้ใช้ npm workspaces ที่บังคับติดตั้งผ่าน parent

ชื่อที่แสดงในหน้าเว็บเปลี่ยนเป็น Zenless Zone Zero / ZZZ และ Timeline ลบ Sayari branding ออกจาก source ของทั้งสองแอป ยังคง `sayari-81b58` ใน Timeline configuration เพราะเป็นรหัสบริการ Firebase เดิม เอกสารและชุด handoff ที่มีชื่อเดิมเก็บที่ parent เป็นประวัติ

## Firebase

ย้าย `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `functions/` และไฟล์ env ไปไว้ใน Timeline ทั้งหมด `.firebaserc` ชี้ `sayari-81b58` ตามเดิม

Firebase Hosting ใช้เฉพาะ `timeline/dist` และ rewrite เส้นทาง `/timeline` ไม่มี routes ของ Calculator/Database และไม่มี cache headers ของ Nanoka/Localization เหลือใน configuration นี้ แยก project ของ Emulator เป็น `demo-timeline`

Auth, Firestore, Storage และ Functions ยังคงใช้ backend V5 เดิม โค้ด backend ทั้งหมดมี hash ตรงกับก่อนย้าย ไม่มีการย้ายข้อมูลจาก ZZZ เข้า Firestore เพราะ ZZZ ใช้ไฟล์ static อยู่แล้ว

**ยังไม่มีการแก้ cloud หรือ deploy:** เว็บไซต์เดิมที่เผยแพร่อยู่และข้อมูลเดิมใน cloud ยังเหมือนเดิม เจ้าของบริการต้องตั้ง public web config, เปิดบริการ/ตรวจ Billing/IAM และ deploy ด้วยตนเองตาม [คู่มือ Firebase](../timeline/FIREBASE_SETUP_TH.md)

## ไฟล์และพฤติกรรมที่เปลี่ยน

| กลุ่ม | ตำแหน่งและรายละเอียด |
|---|---|
| ZZZ source/data | `src` ส่วน ZZZ → `zzz/src`; `public` → `zzz/public`; `tools/nanoka`, `tools/localization` → `zzz/tools` |
| Timeline source/backend | `src/features/timeline`, `src/views/timeline` → `timeline/src`; `functions` → `timeline/functions`; tools → `timeline/tools/timeline` |
| Entry/config | แยก App, main, CSS, index.html, Vite, TypeScript, ESLint, package และ lockfile; Timeline ไม่มี LanguageProvider ของ ZZZ |
| Routes | ZZZ คง `/game/zenless-zone-zero` และ `/game/zenless-zone-zero/database`; Timeline เปิด `/` แล้วไป `/timeline` |
| Branding | ปรับ Database header/footer, Timeline header/footer/register; CSS และ localStorage ภาษาใช้ prefix `zzz` |
| Tests | Timeline ใช้ Playwright ของตัวเองและ `tests/fixtures/vectors.v5.json`; ย้าย Calculator regression ไป ZZZ; ไม่มี dependency ข้ามแอปในชุดทดสอบของแอป |
| Git metadata | `.gitignore` รองรับ build/cache/env ของทั้งสองแอป; `.gitattributes` รักษา raw JSON bytes ที่ตำแหน่งใหม่ |
| Parent | README, summary ปัจจุบัน และ package scripts สำหรับสั่งแอปแต่ละตัว; summary/เอกสารเดิมและ report generators เก็บเป็นประวัติ; template Hosting เก่า `y/` ย้ายไป `docs/archive/legacy-firebase-hosting/` |

การเปลี่ยนคีย์ภาษาเป็น `zzz.locale` ทำให้ preference ชื่อเดิมไม่ถูกอ่าน เมื่อเปิดครั้งแรกจะใช้ภาษาไทยตามค่าเริ่มต้น ตัวเลือกภาษาและการจำค่าใหม่ผ่าน browser tests

รายชื่อย้ายไฟล์และ hash ก่อน/หลังครบ 4,218 รายการอยู่ [file-map.json](../evidence/project-split/file-map.json): 4,188 รายการ bytes เหมือนเดิม และ 30 รายการปรับชื่อ/เส้นทาง/เครื่องมือที่เกี่ยวข้อง รายการนี้ไม่รวม root configuration และไฟล์ใหม่; ตารางด้านบนสรุปส่วนดังกล่าว

## ผลทดสอบจริง

| การตรวจ | ผล |
|---|---|
| ZZZ build / lint | PASS |
| Nanoka unit | 34/34 PASS |
| Thai Localization unit | 11/11 PASS |
| ZZZ browser ภาษาไทย/ข้อมูล/Calculator | 20/20 PASS; 0 page errors |
| Calculator baseline | PASS: DOM, input values และผลตัวเลขก่อน/หลังแก้ค่าเท่ากับ baseline เดิม |
| Timeline production build / lint / Functions build | PASS |
| Timeline Emulator build | PASS |
| Timeline unit | 51/51 PASS |
| Firebase Emulator integration | 23/23 PASS: Auth, Rules, transaction/vote races, Media, restriction และ scheduled handler |
| Timeline browser | 13/13 PASS บน build จาก Hosting Emulator รวม login, form/media, voting, pagination และ touch gestures |
| ตรวจแยก Firebase ใน browser | PASS: ZZZ ไม่ส่งคำขอ Firebase; Timeline Hosting คืน 404 สำหรับ Calculator และ Nanoka JSON |
| ความครบถ้วนข้อมูล/source/kit | 4,137 protected files PASS รวม public data 4,051 ไฟล์ |
| ZZZ lockfile | Firebase dependencies = 0 |
| สภาพพร้อมใช้งานหลังทดสอบ | PASS: Emulator ใหม่มีหัวข้อว่าง 3 หัวข้อ, stories/requests/accounts = 0; นำ fixtures สังเคราะห์ออกแล้ว |
| Git HEAD | ไม่เปลี่ยนจาก `c8fc5b9e75e7a62eed8bad7efcfeacf7f19df3fe` |

หลักฐานใหม่อยู่ `evidence/project-split/`, `zzz/evidence/` และ `timeline/evidence/timeline/` หลักฐานก่อนแยกยังอยู่ที่ `evidence/` เดิม ผล build มีคำเตือนขนาด lazy chunk ของ Timeline ประมาณ 633 kB ซึ่งมีอยู่เดิม ไม่ใช่ build error

แก้ปัญหา dependency หลังแยก: `@apphosting/build` ใน Firebase CLI 14.22.0 เรียก `yaml` โดยไม่ประกาศ dependency ของตัวเอง เดิมอาศัยแพ็กเกจที่ติดมากับ ZZZ จึงระบุ `yaml@2.9.1` เป็น devDependency ของ Timeline โดยตรง และเปิด Emulator สำเร็จครบทุกบริการแล้ว

## การรัน

จาก parent ใช้ `npm run dev:zzz` และ `npm run dev:timeline` เพื่อเปิดคนละ terminal: ZZZ http://127.0.0.1:5173 และ Timeline http://127.0.0.1:5174

ก่อนรัน Timeline ให้เปิด Emulator จากโฟลเดอร์ `timeline` ด้วย `npm run build:emulator`, `npm run emulators` และ `npm run seed` ตาม [README](../timeline/README.md) ทุกคำสั่ง deploy ต้องรันจากแอป Timeline หลังตรวจ configuration จริงแล้ว

## สิ่งที่ยังต้องทำบนบริการจริง

ยังไม่ได้ยืนยัน Web App config, Authentication settings, Firestore/Storage, Billing, IAM, App Check, Scheduler หรือการส่งอีเมลบน cloud ยังไม่ได้ deploy หรือเปลี่ยนโดเมน เว็บไซต์เดิมจึงยังไม่เปลี่ยนเป็น Timeline

ข้อมูล Emulator ก่อนย้ายสำรองอยู่ `timeline/.timeline/before-project-split/` ครบ Auth, Firestore และ Storage ไม่เข้า Git โฟลเดอร์ build/cache เดิมเก็บใน `.migration/` ไม่มีการลบข้อมูลเกมหรือข้อมูล cloud เพิ่มเติม

Git ยังเชื่อม `https://github.com/tawaynap24/sayari.git` branch `main` ไม่มี reset, clean, commit, push หรือ deploy ในงานนี้ Working Tree จะแสดงไฟล์ย้าย/แก้ไขและไฟล์ใหม่ตามจริงจนกว่าผู้ใช้จะสั่ง commit
