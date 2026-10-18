# ภาพและข้อมูลแพตช์ในหน้าเลือกเกม

แสดง 5 เกมตามลำดับเดิม เมื่อ viewport กว้างตั้งแต่ 1200px แสดง 2 การ์ดต่อแถว ต่ำกว่า 1200px แสดง 1 การ์ดต่อแถว การ์ดสุดท้ายที่ไม่มีคู่มีความกว้างเท่าการ์ดอื่นและอยู่คอลัมน์ซ้าย ภาพหลักสูง 100% ชิดขวาและรักษาสัดส่วน ขอบซ้ายใช้ CSS mask ไล่จาง ภาพเดียวกันอีกชั้นขยายและเบลอเป็นบรรยากาศเต็มการ์ด จึงเปลี่ยนสีและธีมตามแพตช์โดยอัตโนมัติ ตัวอักษรอยู่เหนือชั้นไล่ความเข้ม ภาพแต่ละชั้นเป็นภาพตกแต่งและไม่ขวางการกดการ์ด

ภาพหลักใช้ `height: 100%; width: auto; max-width: none` จึงไม่ถูกบีบความกว้างจนเกิดช่องว่างด้านบน/ล่างเมื่อการ์ดแคบกว่าภาพ ส่วนที่กว้างเกินการ์ดถูกซ่อนในกรอบ `overflow: hidden` โดยคงด้านขวาของภาพไว้ ไม่บีบหรือยืดภาพผิดสัดส่วน การทดสอบตรวจความสูงที่ bitmap วาดจริงจากขนาดภาพต้นฉบับด้วย ไม่ตรวจเพียงความสูงของกล่อง `<img>`

หน้า Timeline ของแต่ละเกมแสดง art เดียวกันในส่วนหัว ใช้ `GameArtwork` ร่วมกับการ์ดหน้าแรกและติดตาม cache ภาพเดียวกันแบบ realtime รวมถึงเมื่อเข้าผ่าน deep link หรือเปลี่ยนแพตช์ ภาพส่วนหัวสูงเต็มพื้นที่ ชิดขวา ขอบซ้ายไล่จางและมีภาพเบลอเต็มพื้นหลัง หากยังไม่มีภาพหรือภาพโหลดไม่ได้ ชื่อเกมและเนื้อหายังอ่านและใช้งานได้บนพื้นหลังเข้ม

## สาเหตุและแหล่งข้อมูลใหม่

เดิมเลือก `backgrounds[0]` ของ Launcher ซึ่งอาจเป็นภาพกาชา อีเวนต์ หรือภาพที่ยังไม่ได้เปลี่ยนตามแพตช์ ตอนนี้เลือกภาพจาก **ประกาศอัปเดตแพตช์ที่เปิดใช้งานแล้ว** พร้อมเลขแพตช์และเวลาจากประกาศเดียวกัน ไม่เลือกภาพเพียงเพราะ URL มีวันที่ใหม่กว่า และไม่ใช้ภาพ Special Program ของแพตช์อนาคตแทนแพตช์ปัจจุบัน

| เกม | แหล่งข้อมูลที่เรียกจริง |
| --- | --- |
| Genshin Impact | [Official CMS](https://sg-public-api-static.hoyoverse.com/content_v2_user/app/a1b1f9d3315447cc/getContentList?iPage=1&iPageSize=100&sLangKey=en-us&iChanId=395&iAppId=32): ข่าว `Version … Update Details`, ภาพ `sExt.banner` |
| Honkai: Star Rail | [Official CMS](https://sg-public-api-static.hoyoverse.com/content_v2_user/app/113fe6d3b4514cdd/getContentList?iPage=1&iPageSize=100&sLangKey=en-us&iChanId=248): ข่าว `Version … Update Details`, ภาพ `sExt.news-poster` |
| Zenless Zone Zero | [Official CMS](https://sg-public-api-static.hoyoverse.com/content_v2_user/app/3e9196a4b9274bd7/getContentList?iPage=1&iPageSize=100&sLangKey=en-us&iChanId=288): ข่าว `Version … Update Announcement`, ภาพ `sExt.news-banner` |
| Wuthering Waves | [Official website MainMenu](https://hw-media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/en/MainMenu.json) → ข่าว `Patch Notes for … Version …` → `article/{articleId}.json` → ภาพแนวนอนในเนื้อหา |
| Arknights: Endfield | [Official bulletin API](https://web-news.gryphline.com/api/bulletin?lang=en-us&code=arknights_endfield_official&page=1&pageSize=50) → `Version Update Notes` → `/bulletin/{cid}` สำหรับภาพ/เวลา และ POST [GRYPHLINK](https://launcher.gryphline.com/api/proxy/batch_proxy) ด้วย `get_latest_game` สำหรับเวอร์ชันปัจจุบัน ใช้ major.minor เช่น client 1.6.4 แสดงแพตช์ 1.6 |

สำรวจ API ของเว็บทางการจาก network จริงและทดลองเรียก backend จริง รูปแบบ GRYPHLINK อ้างอิงจาก [ผู้บันทึก request ของ Launcher](https://github.com/horoyoi-san/Endfield/blob/main/src/utils/api/akEndfield/launcher.ts) แล้วเขียน adapter ของโปรเจกต์เอง ไม่มี GitHub mirror เป็นแหล่งข้อมูล runtime

ณ การตรวจสอบ 18/10/2026: Genshin 7.1, HSR 4.6, ZZZ 3.2, Wuthering Waves 3.7, Endfield 1.6 เป็นข้อมูลจาก API จริง ไม่ใช่ค่าที่ฝังใน frontend สำหรับ ZZZ 3.3 เป็นแพตช์ถัดไปที่ [ประกาศว่าจะเปิดวันที่ 21 ตุลาคม](https://www.hoyoverse.com/en-us/news/166759) จึงยังไม่ใช้เป็นแพตช์ปัจจุบัน

## ความหมายของเวลา

แต่ละแถวแสดง “ผู้สนใจ … คน” จาก `topics/{id}.interestCount` เป็นยอดรวมสาธารณะที่ backend อัปเดตพร้อม `topicStats.interestCount` ใน transaction เดียวกัน นับบัญชีที่กดสนใจ ไม่ใช่ผู้ใช้ออนไลน์ การกดซ้ำหลายแท็บไม่เพิ่มยอดและไม่เปลี่ยนเวลาอัปเดต Timeline หน้าแรกติดตามยอดแบบ realtime โดยไม่เปิดเผยรายชื่อผู้สนใจ

จัดข้อมูลเป็นสองแถว: แถวบนเป็นเลขแพตช์และเวลาอัปเดตแพตช์ แถวล่างเป็นผู้สนใจและเวลาอัปเดต Timeline ข้อมูลในแต่ละแถวตัดบรรทัดตามพื้นที่หน้าจอเมื่อจำเป็น

- `patchUpdatedAt`: **เวลาเริ่มอัปเดต/ปิดปรับปรุงแพตช์ตามประกาศทางการ** อ่านจากหัวข้อ maintenance ไม่ใช้เวลาลงข่าว เวลาตรวจ API วันที่ใน URL ภาพ หรือเวลาสิ้นสุดอีเวนต์ ไม่ประมาณเวลาเซิร์ฟเวอร์เปิดจริง
- แสดงเวลาไทย `Asia/Bangkok` ปี ค.ศ. แบบ `DD/MM/YYYY HH:mm น.` เช่นประกาศ 06:00 UTC+8 แสดง 05:00 น. เวลาไทย
- `topics/{id}.timelineUpdatedAt`: เวลาเซิร์ฟเวอร์ที่ข้อมูล Timeline เปลี่ยนจริง อัปเดตใน transaction เดียวกับการเผยแพร่ครั้งแรก การอนุมัติแก้ไข หรือการซ่อน รวมถึงการดำเนินการของผู้ดูแล
- คำขอใหม่ การแก้ไขคำขอ การลงคะแนนที่ยังไม่ผ่าน การยกเลิก/ปฏิเสธ/หมดอายุคำขอ และการกดสนใจ ไม่อัปเดตเวลา Timeline
- ซ่อนเวลา Timeline หากยังไม่เคยมีข้อมูลเผยแพร่ เมื่อเคยเผยแพร่แล้วซ่อนเรื่องราวทั้งหมด ยังคงแสดงเวลาซ่อนล่าสุดได้

## การ refresh และข้อจำกัด

- ไม่มี URL ภาพหรือ hash แพตช์ฝังถาวรใน build
- `timelineGameCovers` เรียก API ฝั่ง backend เพื่อหลีกเลี่ยง CORS และเก็บภาพกับ metadata ใน `siteStats/gameCovers` หน้าเว็บติดตาม Firestore realtime
- ตรวจทุก 15 นาทีด้วย `refreshTimelineGameCovers` และ HTTP endpoint เมื่อเปิดหน้าเว็บ/กลับมาแท็บ การเปลี่ยนภาพไม่ต้อง deploy frontend ใหม่
- แยกความล้มเหลวแต่ละเกม เก็บค่าล่าสุดที่สำเร็จและลองใหม่ใน 1 นาที ไม่เอาภาพอีเวนต์ที่ไม่ทราบเวอร์ชันมาแทน ตรวจ `failedProviders` (เป็น game ID), `checkedAt`, `updatedAt` เพื่อดูสถานะ
- `schemaVersion` ทำให้ cache จากวิธีเลือกภาพเก่าตรวจใหม่ทันที มี Firestore refresh lease ป้องกันเรียกซ้ำพร้อมกัน
- หากยังไม่มี metadata สำเร็จ แสดง “กำลังตรวจสอบ” ไม่สร้างเลขแพตช์หรือเวลาเอง หาก API ล่มหลังเคยสำเร็จ ยังคงแสดงข้อมูลที่ตรวจได้ล่าสุดจนกว่าจะ refresh สำเร็จ
- ตรวจ HTTPS/โดเมน/ชนิดไฟล์ภาพ ไม่ใช้วิดีโอหรือโดเมนที่เลียนแบบชื่อผู้ให้บริการ
- API เหล่านี้เป็น endpoint ของเว็บ/Launcher ทางการ ไม่พบสัญญารับประกัน public developer API หาก schema หรือชื่อหัวข้อเปลี่ยน adapter อาจต้องปรับ ระบบเก็บข้อมูลสำเร็จล่าสุดแทนการเดา

## ข้อมูลเดิมและการนำขึ้น cloud

`npm run seed` ยังคงรักษา stories, memberships, counters และปฏิทินเดิม ไม่ลบหัวข้อเก่าหรือประวัติ

โปรเจกต์ cloud ที่มีอยู่ก่อนเพิ่มยอดผู้สนใจสาธารณะ ให้ใช้ `admin.mjs seed-topics --project sayari-81b58` ตรวจ dry run และเพิ่ม `--execute --reason "Sync public interest counts"` เมื่อดำเนินการจริง ตัวช่วยคัดลอกยอดเดิมจาก `topicStats` แบบ transaction โดยไม่ล้างสมาชิกหรือเริ่มนับใหม่ หลังจากนั้นการกดสนใจจะอัปเดตทั้งสองค่าเอง

Timeline ที่มีอยู่ก่อนเพิ่ม `timelineUpdatedAt` ให้ backfill จาก `revisions.approvedAt`, `stories.hiddenAt` และ audit การซ่อนฉุกเฉิน ไม่ใช้ `submittedAt` ของคำขอ ตัวช่วยทำงานแบบ dry run เป็นค่าเริ่มต้นและไม่เขียนทับค่าที่ใหม่กว่าซึ่งเพิ่งอนุมัติพร้อมกัน

```powershell
# อ่านรายงานก่อน ไม่มีการแก้ข้อมูล
node tools/timeline/admin.mjs backfill-timeline-updates --project sayari-81b58
# ผู้ดูแลดำเนินการเมื่อจะนำขึ้นระบบจริง
node tools/timeline/admin.mjs backfill-timeline-updates --project sayari-81b58 --execute --reason "Backfill timeline publication and hide timestamps"
```

cloud ต้องใช้ frontend, `timelineApi`, `timelineGameCovers`, `refreshTimelineGameCovers`, Firestore Rules และ Billing/Scheduler ตามคู่มือ Firebase เดิม ตรวจ cloud credentials/project ให้ถูกต้องก่อนดำเนินการ ไม่มีการ deploy หรือเขียน cloud อัตโนมัติในการแก้ไขนี้ ทดสอบและ backfill เฉพาะ Emulator `demo-timeline` แล้ว

## การทดสอบ

```powershell
npm run check
npm run build:emulator
npm run test:game-covers
npm run test:integration
npm run test:games:browser
```

หลักฐาน API จริงอยู่ `evidence/timeline/game-covers-live.json` เป็นผล ณ เวลาตรวจ ไม่ใช่ config ที่ runtime ใช้งาน การทดสอบครอบคลุมไม่เลือกแพตช์อนาคต/ภาพอีเวนต์ การแปลง timezone ช่วง maintenance ที่มีวันที่ซ้ำ cache/lease/provider failure ภาพจริงทั้ง 5 เกม desktop/mobile และเวลา Timeline ที่เปลี่ยนเฉพาะเมื่อข้อมูลสาธารณะเปลี่ยน
