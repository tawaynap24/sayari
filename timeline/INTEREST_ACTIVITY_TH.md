# ความสนใจหมดอายุเมื่อไม่ได้เปิดหัวข้อนั้น 7 วัน

## พฤติกรรม

- นับแยกตามบัญชีและหัวข้อ ไม่ใช่เวลาใช้งานเว็บไซต์รวม เช่น เปิด Genshin จะไม่ต่ออายุให้ Star Rail
- ต้องเข้าสู่ระบบและเปิดหน้าของหัวข้อนั้นในแท็บที่มองเห็นอยู่ รวมหน้ารายละเอียดเรื่องราวและหน้าคำขอของหัวข้อนั้น
- บันทึกตอนเปิด/กลับเข้าหน้า กลับมา foreground และเชื่อมต่อใหม่ พร้อม heartbeat ทุก 5 นาทีขณะหน้านั้นแสดงอยู่ Server ลดการเขียนซ้ำจากหลายแท็บภายใน 5 นาที
- หน้าแรก การดูหัวข้ออื่น Guest แท็บเบื้องหลัง การต่ออายุ session อัตโนมัติ และ API เขียนข้อมูล/โหวต ไม่ต่ออายุความสนใจ
- เส้นตายคือเวลา activity ที่ Server บันทึกล่าสุด + 604800000 ms เมื่อถึงเส้นตายถือว่าหมดอายุทันที Activity ที่มาถึงหลังหมดอายุไม่ทำให้กลับมาสนใจเอง
- กลับมาแล้วต้องกด **สนใจหัวข้อนี้** ใหม่ ไม่ต้องสมัครบัญชีใหม่ ระบบ login/session 3 วันยังแยกจากเงื่อนไขนี้
- งาน `expireTimelineInterests` ทำงานทุก 5 นาที ครั้งละสูงสุด 200 รายการ จึงอาจเห็นยอดเก่าระหว่างรอบงาน หรือระหว่างระบายรายการค้าง แต่สิทธิ์สมาชิกหมดตั้งแต่เส้นตายโดยไม่ต้องรอ Scheduler การกลับมาเปิดหัวข้อที่หมดอายุก็ล้างรายการของตัวเองทันที
- ลบ `topics/{topicId}/interests/{uid}` และ `users/{uid}/followedTopics/{topicId}` พร้อมลด `topicStats/{topicId}.interestCount` และ `topics/{topicId}.interestCount` ใน transaction เดียว หน้ารวมและหน้าหัวข้ออัปเดตตาม realtime listener เดิม
- การต่ออายุ/หมดอายุ/ยืนยันสนใจใหม่ไม่เปลี่ยน `timelineUpdatedAt` ไม่ลบเรื่องราวหรือประวัติการโหวต และไม่คำนวณเกณฑ์ใหม่กลางรอบโหวต คำขอรอบใหม่ใช้จำนวนผู้สนใจที่ปรับปรุงแล้ว

## ความสนใจเดิม

ก่อนหน้านี้ไม่มีประวัติการเปิดหน้าแยกตามหัวข้อ จึงไม่อ้างวันที่กดสนใจเดิมเป็นวันที่เปิดล่าสุด ผู้สนใจเดิมได้รับระยะเริ่มต้น 7 วันครั้งเดียวจากเวลาที่อัปเกรดเอกสาร การเปิดหัวข้อระหว่างช่วงนี้จะเริ่มบันทึก activity ทันที

Scheduler และ worker ในเครื่องเรียก `migrateLegacyPage()` ก่อนล้างรายการ สแกนครั้งละ 200 เอกสาร มี checkpoint `maintenance/interestActivityV1` เพื่อทำต่อได้โดยไม่สแกนทั้งหมดทุกครั้ง เอกสารที่มี `expiresAt` แล้วจะไม่ถูกต่ออายุซ้ำระหว่าง migration

## โค้ด

- `functions/src/domain/interest.ts`: อายุความสนใจและการตรวจเส้นตาย ใช้ร่วมกับ Frontend
- `functions/src/interests.ts`: ยืนยันสนใจ ต่ออายุ ลบรายการหมดอายุ ปรับยอด และ migration
- `functions/src/service.ts`: ตรวจสมาชิกที่ยังไม่หมดอายุก่อนส่ง/แก้ไข/โหวต
- `functions/src/index.ts`: callable `timelineTopicActivity` และ Scheduler `expireTimelineInterests`
- `src/features/timeline/useTopicInterest.ts`: ส่ง activity เฉพาะหน้าหัวข้อที่แสดงอยู่ และซ่อนสิทธิ์สมาชิกเมื่อหมดอายุ
- `firestore.rules`, `storage.rules`, `functions/src/media.ts`: ป้องกันการใช้สิทธิ์เดิมหลังหมดอายุ
  Storage ตรวจเส้นตายที่ Server ใส่ใน descriptor ตอนเตรียมอัปโหลด พร้อมตรวจสมาชิกจริงซ้ำตอน finalize เพื่อให้ไม่เกิน [ข้อจำกัดอ่าน Firestore 2 เอกสารต่อ Storage Rules request](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_cloud_firestore) หากปล่อยแบบอัปโหลดเกินเส้นตายที่เตรียมไว้ ต้องเตรียมอัปโหลดใหม่
- `firestore.indexes.json`: single-field collection-group index ของ `interests.expiresAt` ตาม [Firebase index definition](https://firebase.google.com/docs/reference/firestore/indexes) ใช้ transaction สำหรับลบและปรับยอด ไม่เปิด Firestore TTL เพราะการลบเอกสารอย่างเดียวจะไม่ปรับยอดและดัชนีของผู้ใช้
- `tools/timeline/sweep.mjs`: worker สำหรับ Emulator

## เปิดใช้บน Firebase จริง

ยังไม่ได้ Commit, Push หรือ Deploy งานนี้

1. อัปโหลด Firestore index ที่เพิ่มและรอให้พร้อมใช้งาน
2. อัปโหลด Functions ที่แก้ไข: `timelineApi`, `timelineTopicActivity`, `expireTimelineInterests`, `timelineMedia` (และ codebase เดิมตามขั้นตอนของโครงการ) Scheduler ต้องใช้ Billing/Cloud Scheduler ตาม `FIREBASE_SETUP_TH.md`
3. อัปเดต Firestore/Storage Rules และ Frontend พร้อมกันตามรอบเผยแพร่ของโครงการ เพื่อให้ client ส่ง activity ได้
4. ตรวจ log `timeline interest expiry` ว่า migration ทำครบ (`complete: true`) และงานหมดอายุทำงานทุก 5 นาที ไม่ต้องกดลบข้อมูลหรือปรับยอดด้วยมือ

## ทดสอบ

ต้องเปิด Emulator และ Vite ก่อน integration/browser tests:

```powershell
npm test
npm run test:interests
npm run test:interests:browser
npm run test:integration
npm run test:browser
npm run build
npm run lint
```

หลักฐานเฉพาะระบบนี้อยู่ที่ `evidence/timeline/interests-integration.json` และ `evidence/timeline/interests-browser.json` การทดสอบเวลา 7 วันใช้ clock ของ service กับ fixture เฉพาะหัวข้อ ไม่เร่งเวลาหรือลบผู้สนใจของเกมจริง การทดสอบ migration ใช้ namespace Emulator แยกและล้างข้อมูลทดสอบเมื่อจบ

ผลทดสอบจริง 18/10/2026:

| ชุดทดสอบ | ผล |
| --- | --- |
| Production Build / Backend TypeScript / Lint | ผ่าน |
| Unit Tests รวมเงื่อนไขครบ 7 วัน | 71/71 |
| Interest Integration: เวลาแต่ละหัวข้อ, transaction, race, Rules, media, migration, callable | 8/8 |
| Interest Browser: foreground/background, เปิดสองหัวข้อ, ยืนยันใหม่, จำนวนบนการ์ด realtime | 5/5 |
| Integration เดิมของ Timeline/Voting | 24/24 |
| Browser เดิม รวมสร้าง/แก้ไข/โหวตและอัปโหลดรูป/PDF/DOCX | 13/13 |
| Session และ Storage Rules | 5/5 |

หัวข้อสังเคราะห์และข้อมูลที่ชุดทดสอบความสนใจสร้างไว้ถูกล้างแล้ว เปิด worker รุ่นใหม่ใน Emulator เพื่อรันเงื่อนไขต่อเนื่องในเครื่อง ส่วน Firebase จริงยังไม่ได้เผยแพร่
