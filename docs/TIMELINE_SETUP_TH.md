# Sayari Timeline V5 — การรันและตั้งค่าระบบ

โค้ดนี้ใช้ Firebase Auth, Firestore, Cloud Functions v2, Storage และ Hosting จริงใน Local Emulator ไม่มีการ deploy หรือแก้บริการใน `sayari-81b58` การตั้งค่า `.firebaserc` เดิมยังคงอยู่ โปรเจกต์ทดสอบทุกคำสั่งใช้ `demo-sayari-timeline` อย่างชัดเจน

## เริ่มใน Windows / PowerShell

ใช้ Node 22 และ Java 17 กับ Firebase CLI 14.22.0 ที่ล็อกไว้ใน devDependencies (Java 21 เป็นทางเลือกสำหรับการอัปเกรด CLI ในอนาคต) dependency และ emulator binaries ต้องดาวน์โหลดครั้งแรก หลังจากนั้นใช้ cache ใน `.timeline/` ซึ่งไม่เข้า Git

```powershell
Set-Location D:\sayari-project
npm.cmd ci
npm.cmd --prefix functions ci
npm.cmd run timeline:build
npm.cmd run timeline:emulators
```

รอข้อความว่าทุก Emulator พร้อมใช้งาน แล้วเปิด PowerShell อีกหน้าต่าง:

```powershell
Set-Location D:\sayari-project
npm.cmd run timeline:seed
npm.cmd run timeline:dev
```

เปิด http://127.0.0.1:5174/timeline — สมัครบัญชีทดสอบด้วย Email/Password แล้วเลือกหัวข้อและกด **สนใจหัวข้อนี้** การเปิดหัวข้อเฉย ๆ ไม่เพิ่มจำนวนผู้สนใจ

Emulator UI: http://127.0.0.1:4000 / Hosting Emulator: http://127.0.0.1:5000

| บริการ | พอร์ต |
|---|---:|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| Hosting | 5000 |

`timeline:seed` สร้างเฉพาะหมวดและหัวข้อว่าง โดยไม่เขียนทับหัวข้อเดิม ไม่มีเนื้อเรื่องเกมตัวอย่าง คำสั่งทดสอบมีข้อมูลสังเคราะห์ที่ใช้ชื่อหัวข้อทดสอบชัดเจน ข้อมูล Emulator อยู่ในหน่วยความจำและหายเมื่อปิด หากต้องการเริ่มสะอาด ให้ปิดชุด Emulator ด้วย Ctrl+C แล้วเปิดใหม่และ seed อีกครั้ง ไม่ต้องลบ source หรือใช้ Git clean

`timeline:emulators` มี worker ในเครื่องเรียกตรวจหมดอายุทุก 5 นาทีเพื่อใช้งาน local ได้ครบ ฟังก์ชัน scheduled สำหรับ cloud อยู่ใน `functions/src/index.ts` การเรียก handler ใน Emulator ไม่ใช่การยืนยันว่า Cloud Scheduler ของ production ถูกสร้างแล้ว

```powershell
# เรียก expiry + cleanup ใน Emulator ทันที
npm.cmd run timeline:sweep
```

## ทดสอบซ้ำ

```powershell
npm.cmd run timeline:unit
npm.cmd run lint
npm.cmd run build
npm.cmd run nanoka:test
npm.cmd run localization:test

# กรณีไม่มี Emulator เปิดอยู่: เริ่ม/ทดสอบ/หยุดให้อัตโนมัติ
npm.cmd run timeline:test

# กรณีเปิด Emulator อยู่แล้ว
node tools/timeline/integration.mjs

# ต้องเปิด Vite พอร์ต 5174 และ seed หัวข้อ community แล้ว
npm.cmd run timeline:browser
npm.cmd run timeline:verify
```

Browser tests ใช้ Edge headless ผ่าน Playwright ที่มีอยู่ในเครื่องมือ Nanoka เดิม หากติดตั้งจาก checkout ใหม่ให้ `npm.cmd --prefix tools/nanoka/tools/network-discovery ci` ด้วย (ตรวจ package-lock ในโฟลเดอร์นั้น) ไม่ใช้บัญชีจริงและไม่เรียกข้อมูลเกมจากภายนอกเพื่อสร้าง Timeline

`npm run build` เป็น production build: เมื่อยังไม่มี Firebase web configuration หน้า Timeline จะแสดงว่าต้องเชื่อมต่อฐานข้อมูลก่อน ส่วนหน้า ZZZ/Nanoka ยังเปิดได้ตามเดิม `timeline:build` ใช้ `.env.emulator` และมีข้อความบอกพื้นที่ทดสอบ ห้ามนำผล build โหมด emulator ไป production

## สิ่งที่เจ้าของโปรเจกต์ต้องทำเองก่อนใช้งานบนเว็บไซต์จริง

1. ตรวจ project ID ใน Firebase Console ให้ตรง `sayari-81b58` และยืนยันสิทธิ์ของคุณ โค้ดนี้ยังไม่ได้ตรวจสถานะบริการหรือแผนบัญชีจริง
2. เพิ่ม/เลือก Web App แล้วคัดลอก **public web config** ลง `.env.local` ตาม `.env.example` โดยตั้ง `VITE_FIREBASE_EMULATORS=false` ใส่ชื่อ bucket จริงซึ่งอาจลงท้าย `.firebasestorage.app` หรือ `.appspot.com` อย่าใส่ service-account private key ลงใน Vite env หรือ Git
3. Authentication → Sign-in method → เปิด Email/Password และตั้ง authorized domains ของเว็บไซต์ ตั้ง password policy ที่ต้องการ การเปิดตัวครั้งนี้ไม่บังคับ email verification ตาม V5 [เอกสาร Firebase Auth](https://firebase.google.com/docs/auth/web/password-auth)
4. สร้าง Firestore **default database** และ Storage bucket เลือก region ให้เหมาะสม Functions ในชุดนี้ใช้ `asia-southeast1` ตรวจแผนและ Billing ด้วยตนเอง Cloud Storage/Functions/Scheduler อาจต้องใช้ Blaze และมีค่าบริการ ไม่ได้เปิดหรืออนุมัติ Billing ให้ [เอกสาร Storage](https://firebase.google.com/docs/storage/web/start), [Scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions)
5. ตรวจ `firestore.rules`, `storage.rules`, `firestore.indexes.json` และ `firebase.json` ก่อน deploy ด้วยตนเอง Rules ปิด direct client writes ทั้งหมด Storage Rules อ่าน metadata จาก default Firestore จึงต้องเปิดสิทธิ์เชื่อมบริการตามที่ Console/CLI ขอ [เอกสาร Storage Rules + Firestore](https://firebase.google.com/docs/storage/security/rules-conditions)
6. ตรวจ IAM ของ runtime service account ให้เข้าถึง Firestore และ Storage ที่จำเป็น ตรวจสิทธิ์ Cloud Scheduler เรียก scheduled functions และเตรียม budget alerts ใช้ credential ของ operator เฉพาะเครื่อง/CI ที่เชื่อถือได้
7. ตั้ง App Check ให้เว็บแอป เมื่อมี site key ให้ใส่ `VITE_FIREBASE_APPCHECK_SITE_KEY` และกำหนด `TIMELINE_ENFORCE_APP_CHECK=true` ใน environment ของ Functions ก่อน deploy ใหม่ เริ่มติดตาม metrics ให้แน่ใจว่า browser จริงได้ token แล้วจึง enforce การทดสอบ local ไม่ต้องมี App Check [เอกสาร App Check](https://firebase.google.com/docs/app-check/cloud-functions)
8. Deploy เฉพาะเมื่อคุณสั่งเอง หลัง rules/indexes/functions พร้อม จึง seed **metadata ของหัวข้อว่าง** และตรวจ deep links, email login, Storage CORS/media endpoint, voting และ jobs บน staging ก่อน production

ไม่มีคำสั่ง deploy อัตโนมัติใน scripts และไม่มีการรันขั้นตอน Console/IAM/Billing ข้างต้นในงานนี้

## เครื่องมือสำหรับ operator (dry run เป็นค่าตั้งต้น)

เครื่องมือ `tools/timeline/admin.mjs` ต้องระบุ `--project` เสมอ ใช้ Application Default Credentials ของ operator เท่านั้น โหมด demo จะบังคับ Emulator ไม่ใช้ credential production ตัวอย่างต่อไปนี้เป็น dry run ไม่เขียน:

```powershell
node tools/timeline/admin.mjs seed-topics --project sayari-81b58
node tools/timeline/admin.mjs claim --project sayari-81b58 --uid USER_UID
node tools/timeline/admin.mjs restrict-story --project sayari-81b58 --story STORY_ID --reason "เหตุผลที่ตรวจสอบแล้ว"
```

หลังตรวจผลแล้ว ผู้ดูแลที่ได้รับอนุญาตต้องเพิ่ม `--execute --reason "เหตุผล"` ด้วยตนเองเพื่อเขียนจริง `claim` ตั้ง trusted custom claim `timelineModerator: true`; ใช้ `--revoke` เพื่อถอน ผู้ใช้ต้องเข้าสู่ระบบใหม่/refresh token ก่อน UI จะแสดงสิทธิ์ ห้ามให้ client แก้ role ใน Firestore

`restrict-story` เป็นทางด่วนจำกัดข้อมูลที่มีปัญหากฎหมาย/ข้อมูลส่วนบุคคล: ซ่อน public projection, ปิด archive และ media ต่อสมาชิก/เจ้าของไฟล์, ยกเลิกและจำกัดคำขอที่เกี่ยวข้อง และสร้าง audit ระบบเก็บข้อมูลส่วนตัวไว้ให้ operator ตรวจสอบ การลบถาวรจาก backups หรือการดำเนินการทางกฎหมายยังเป็นงานของผู้ดูแลตามนโยบายของเว็บไซต์ ไฟล์ที่ผู้ใช้เคยเก็บไว้หรือ URL ของสื่อภายนอกไม่สามารถดึงคืนได้

## การดูแลระบบและข้อจำกัดที่ต้องทราบ

- `requests`: ค้น pending + expiresAt เพื่อดู backlog; `auditLog`: การเปลี่ยนสถานะและ privileged reason; `abuseReports`: รายงานเนื้อหาจากสมาชิก; `maintenance/mediaCleanup`: ตำแหน่งสแกนและจำนวนไฟล์ที่ล้าง; Cloud Functions logs: expiry/cleanup counts และ errors
- Sweeper ทำทีละ 100 คำขอทุก 5 นาที พร้อมตรวจ deadline ทุกครั้งที่โหวต/แก้คำขอ แม้ Scheduler ยังไม่รันก็ไม่ยอมรับคะแนนหลัง deadline
- Cleanup ตรวจสื่ออายุเกิน 7 วันครั้งละ 100 ไฟล์ มี cursor ข้ามชุดที่สแกนแล้ว เก็บสื่อที่มี approved revision หรือยังใช้ใน pending request ไว้ ลบ orphan bytes นอก transaction แบบ retry ได้ Metadata ที่ลบแล้วเก็บสถานะไว้
- จำกัด mutation 120 ครั้ง/นาที/UID และเริ่ม upload 50 ไฟล์/ชั่วโมง/UID ผ่านเซิร์ฟเวอร์ ยังไม่ใช่การรับรองว่า 1 บัญชี = 1 คน ผู้ดูแลต้องติดตามการสร้างบัญชีและการสลับคะแนนเพื่อยืดเวลา
- Public data เปิดให้ guest ตามข้อกำหนด ข้อห้ามอ่านสำหรับสมาชิกที่ยังไม่ follow เป็น UX/query gate ผู้ใช้สามารถ logout เพื่ออ่านข้อมูลสาธารณะได้
- Query เรื่องราว/คำขอแบ่งหน้าละ 60 รายการ พื้นที่เส้นเวลาแสดงเฉพาะ markers ที่อยู่ใน viewport; เส้นเวลาในช่วงที่ยังไม่ได้โหลดแสดงได้เมื่อกดโหลดเพิ่มเติม ส่วน metadata หัวข้อ/ชื่อเฉพาะ/ประวัติมีเพดานอ่าน 200 รายการต่อชุด ไม่สแกนทั้งฐานข้อมูล
- รูปภาพ URL และวิดีโอภายนอกขึ้นกับเจ้าของต้นทาง Embed จำกัด YouTube/Vimeo เอกสาร PDF ใช้ PDF.js วาด canvas โดยไม่รัน JavaScript ในเอกสาร DOCX แสดงข้อความ/ย่อหน้า/ตารางแบบข้อความ ไม่รัน HTML/macros และไม่โหลด external relationships; ไม่รองรับ legacy `.doc`
- การตรวจไฟล์ตรวจขนาด MIME magic bytes และโครงสร้าง DOCX พร้อมปิด PDF active actions ที่รู้จัก ไม่ใช่บริการสแกนมัลแวร์เต็มรูปแบบ
- ปฏิทินเริ่มแบบ symbolic ไม่มีการเดาว่าปีละ 365 วันหรือเดือนละ 30 วัน `calendar.units` เป็นตัวคูณ tick ที่ผู้ดูแลกำหนดชัดเจน ถ้าไม่มี mapping/ความละเอียดพอ จะแสดงเวลาที่ยังไม่ชัดเจน
- ฐานข้อมูล production, ส่งอีเมล reset จริง, App Check enforcement, billing, IAM, Cloud Scheduler delivery และ storage region/egress ยังไม่ได้ยืนยันจากบริการ cloud จริง
