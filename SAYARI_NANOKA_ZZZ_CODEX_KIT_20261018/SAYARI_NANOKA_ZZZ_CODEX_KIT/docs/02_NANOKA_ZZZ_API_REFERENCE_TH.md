# 02 — Nanoka ZZZ: API reference สำหรับงานนี้

## สถานะของ reference

ข้อมูลตารางด้านล่างตรวจจาก implementation ของ client สาธารณะ ไม่ใช่ OpenAPI ทางการของ Nanoka และยังไม่ได้ทดสอบ HTTP JSON สำเร็จจากสภาพแวดล้อมเตรียม ZIP ดู `evidence/PREPARATION_STATUS.json` ก่อนใช้

แหล่งอ้างอิงทั้งหมดมี URL ใน `reference/sources.json` ฟิลด์ของ Python model บางตัวผ่าน alias/validator แล้ว จึงต้องยึด **raw response ที่ Codex ได้จริง** ในการทำ adapter

## A. รูปแบบการเรียก

```text
Data origin: https://static.nanoka.cc
Website reference: https://zzz.nanoka.cc/
Assets prefix observed in client: https://static.nanoka.cc/assets/zzz/
Method: GET
```

Client ที่ตรวจไม่ส่ง API key/cookie สำหรับ endpoint เหล่านี้ จึงเริ่มด้วย public GET ได้ แต่ไม่ได้รับรองว่าไม่มีข้อจำกัด access/rate/CORS ในอนาคต [C01,C02,C04]

### รายการ seed: 10 URL templates

| # | URL / path | ความหมาย | การขยายรายการ |
|---|---|---|---|
| 1 | `https://static.nanoka.cc/manifest.json` | รายการเวอร์ชัน | อ่าน `zzz` |
| 2 | `/zzz/{version}/character.json` | Agent index | เก็บทุก dictionary key เป็น ID |
| 3 | `/zzz/{version}/{lang}/character/{id}.json` | Agent detail | ทุก ID × ทุก locale |
| 4 | `/zzz/{version}/weapon.json` | W-Engine index | เก็บทุก ID |
| 5 | `/zzz/{version}/{lang}/weapon/{id}.json` | W-Engine detail | ทุก ID × ทุก locale |
| 6 | `/zzz/{version}/bangboo.json` | Bangboo index | เก็บทุก ID |
| 7 | `/zzz/{version}/{lang}/bangboo/{id}.json` | Bangboo detail | ทุก ID × ทุก locale |
| 8 | `/zzz/{version}/equipment.json` | Drive Disc Set index | เก็บทุก ID |
| 9 | `/zzz/{version}/{lang}/equipment/{id}.json` | Drive Disc Set detail | ทุก ID × ทุก locale |
| 10 | `/zzz/{version}/{lang}/item.json` | Item dictionary | ทุก record ในไฟล์; ไม่ต้องเดา item/{id} |

Paths 2–10 ต่อจาก data origin; registry ที่รันได้อยู่ใน `reference/endpoints.seed.json` [C01,C02]

ยังไม่พบหลักฐานใน client นี้สำหรับ endpoint standalone ของ Skill, Mindscape, Promotion, Skin, Potential หรือ item detail แยกหนึ่งชิ้น ข้อมูลบางอย่างอยู่ nested ใน detail แล้ว การสร้าง `/skills`, `/mindscape`, `/new.json` ตามชื่อ model ไม่ใช่การยืนยัน API

### Versions

โมเดล manifest ใช้ raw keys `zzz.live`, `zzz.latest`, `zzz.available` [C03] ต้องอ่านจาก response จริง โดย:

- `live` เป็น default data view ตาม channel ของผู้ให้ข้อมูล ไม่ใช่การรับรองของเราว่าตรงทุกภูมิภาคทันที
- `latest` แยก dataset/version badge ไม่แทนที่ live เงียบ ๆ และอย่าตีความ latest=officially released
- `available` เป็นรายการเวอร์ชันที่เลือกเพิ่มได้ ต้องรักษาสตริงเดิมรวม build suffix และ encode แต่ละ path segment

อย่าเขียนเลขเวอร์ชันจาก search snippet ลง config เป็นค่าถาวร ถ้า manifest เปลี่ยน schema ให้รายงาน ไม่ default ไปเวอร์ชันเดา

### Languages

ZZZ mapping ใน client ที่ตรวจ: `en`, `ja`, `ko`, `zh` [C04] สี่ภาษาเป็นจุดเริ่มตรวจ ไม่ใช่สัญญาว่า endpoint ทุกตัวรองรับทุกภาษาเสมอ

Index กลุ่ม character/weapon/bangboo มี localized names เป็น field ตามภาษา และ equipment มี localized objects ตามภาษา ส่วน detail เลือกภาษาที่ path เก็บ fallback แยกกับ requested language และอย่าปลอมว่ามีภาษาไทยจาก Nanoka

## B. Data dictionary ที่ต้องให้ UI ครอบคลุม

รายการนี้ช่วยเริ่มออกแบบ UI ไม่ใช่ exhaustive schema ถ้า raw มี key อื่น ให้เพิ่มใน field inventory และ generic renderer โดยไม่ต้องรอแก้ interface ให้ครบก่อนเก็บข้อมูล

### Agents [M01]

| กลุ่ม | Raw keys ที่เห็นใน source model | วิธีแสดง |
|---|---|---|
| ตัวตน | `id`, `name`, `code_name`, `icon`, `rarity` | ข้อมูลพื้นฐานและภาพพร้อม source |
| หมวด | `weapon_type`, `element_type`, `special_element_type`, `hit_type`, `camp`, `gender` | ID + label จริง; unknown enum ยังเห็นได้ |
| Profile/lore | `partner_info` | ทุกข้อความ/เงื่อนไขที่มีจริง ไม่บังคับ object ว่างเป็น error |
| Stats | `stats` | ทุก property รวม Tags/tags ที่มีจริง; raw กับ formatted ต้องแยก |
| Mindscape | `talent` | ทุก entry, name, desc, desc2 |
| Progression | `level`, `extra_level` | ทุกขั้นและทุก material/extra property ไม่แสดงแค่ max level |
| Skills | `skill` | ทุกประเภท/ทุก description/ทุก parameter/material level |
| Core | `passive` | levels/names/descriptions/materials ตาม response |
| Appearance/other | `skin`, `potential_detail` | render เมื่อมี รวม nested field และภาพที่ตรวจ URL |

Index ใช้บาง key ต่างจาก detail เช่น `code`, `rank`, `type`, `hit`, `desc`, `en/ja/ko/zh` ห้ามสร้าง schema เดียวแบบ cast แล้วลืมความต่าง

Skill parameter มีโครงสร้างอย่าง `description → param → param` และค่า `main`, `growth`, `format` ใน model แต่ **อย่าเดาสูตร/หน่วยเพียงเพราะชื่อคล้ายกัน** แสดง raw กับหน่วยที่ยืนยันได้ก่อน งานนี้ไม่จำเป็นต้องสร้าง damage simulation

Wrapper มีการ exclude MC IDs และลบ tags บางส่วนเมื่อ normalize; ในงานนี้ต้องเก็บ raw ทุก field/ทุก ID ไว้ครบ

### W-Engines [M02]

raw detail ที่เห็น: `id`, `code_name`, `name`, `desc`, `desc2`, `desc3`, `rarity`, `icon`, `weapon_type`, `base_property`, `rand_property`, `level`, `stars`, `materials`, `talents`

สร้าง sections สำหรับ description, base/secondary property, progression ทุก level, stars, materials และ refinement/talent ทุกขั้น Property อาจมี `name`, `name2`, `format`, `value`; level อาจมี `exp`, `rate`, `rate2`

อย่าคิดว่า `materials` เป็น array เสมอ: model ที่ตรวจระบุเป็น string ต้อง inspect response จริงก่อนแบ่งตาราง Preserve original ไม่ parse แล้วทิ้งข้อความเดิม

### Bangboo [M03]

raw detail ที่เห็น: `id`, `code_name`, `name`, `desc`, `rarity`, `icon`, `stats`, `level`, `skill`

`skill` มีหมวด a/b/c และ nested level ซึ่ง client รองรับทั้ง `level`/`Level`; บางกลุ่มเป็น null ได้ จึงต้องแสดง “ไม่มีข้อมูลใน response” แทนข้อมูลปลอม

แสดงทุกขั้นการเติบโต วัสดุ extra properties และค่าของสกิลที่ต้นทางส่ง รวม `name`, `desc`, `property`, `param` ที่อาจเป็น string ไม่ใช่ตัวเลขเสมอ

### Drive Disc Sets [M04]

raw detail ที่เห็น: `id`, `name`, `desc2`, `desc4`, `story`, `icon` ให้แสดงโบนัส2/4ชิ้นและข้อความทุกส่วน

Index มี `icon` และ localized objects; แต่ละภาษาอาจมีชื่อและโบนัส ไม่เท่ากับรายการ Drive Disc แต่ละชิ้นที่ผู้เล่นถือครอง และไม่ยืนยันว่า endpoint นี้มี main/substat table ทั้งหมด ต้อง discovery ส่วนเพิ่มเติมถ้ามี

### Items / Materials [M05]

localized item dictionary มี record ID กับ `icon`, `rank`, `class`, `name` ตาม model; ฟิลด์อื่นให้รับจาก actual JSON

แสดงทุก class/rank ไม่กรองเหลือแค่วัสดุ Agent การเชื่อม itemId จาก progression/skills ต้องไม่ทิ้ง ID ที่ lookup ไม่พบ แสดง ID เดิมพร้อมป้าย unresolved reference

ไม่มีหลักฐานจาก client ที่ตรวจว่าทุก item มี description, drop location, ราคา หรือ standalone detail API อย่าสร้างข้อมูลเหล่านี้เอง

### New/change data [M06,W05]

มี model ที่ระบุรายการ IDs ใหม่และ previous versions แต่ model เพียงอย่างเดียวไม่ได้ยืนยัน URL ของ endpoint ให้ดู actual Network ของหน้า home/diff หาก diff คำนวณจากสอง snapshot ใน browser ให้ระบุเป็น local derived view ไม่ใช่แอบอ้างว่าเป็น `/diff` API

## C. หมวดที่ต้อง discovery เพิ่มจากเว็บจริง

| หน้า reference ที่พบ | สิ่งที่ต้องตรวจเพิ่ม |
|---|---|
| `/monster` | source ของ index/detail/stats/level variants ที่หน้านี้โหลดจริง [W01] |
| `/achievement` | groups/conditions/rewards และ payload จริง [W02] |
| `/shiyu` | seasons/stages/enemies/buffs/ทุก selector ที่มีจริง [W03] |
| `/hollow` | ข้อมูลทุก subcategory/tab ตาม UI จริง ไม่หยุดที่แท็บแรก [W04] |
| `/diff` | ดึง payload แยกหรือ compare existing data; ต้องเก็บ provenance ของสองเวอร์ชัน [W05] |
| เมนูอื่นที่ค้นพบ | เพิ่มเป็น scope พร้อมหลักฐาน ไม่เดาชื่อ endpoint จากความคุ้นเคยกับ ZZZ |

ชื่อด้านซ้ายเป็น **website route** ไม่ใช่เส้นทาง JSON ที่ยืนยันแล้ว ข้อมูลที่อาจพบด้านขวาเป็นรายการที่ต้องตรวจ ไม่ใช่การรับรองว่ามีครบทุกชนิด

## D. รูปภาพและ reference URLs

Client มี assets prefix `https://static.nanoka.cc/assets/zzz/` และแปลงชื่อภาพบางชนิดเป็น `.webp` [C04,M01–M05] แต่การประกอบชื่อภาพได้ไม่เท่ากับ HTTP200 ต้องทดสอบ helper ของแต่ละประเภทและมี fallback

ใช้ asset URL จริงหรือ mapping ที่ตรวจจาก source; ห้ามใช้ `<id>.png` โดยเดา ห้ามแทนภาพที่หายด้วยรูปจากอีกฐานข้อมูลแล้วติดที่มา Nanoka

ทุกหน้าให้ลิงก์ `https://zzz.nanoka.cc/` และ entity reference ที่มีหลักฐาน ตัวอย่างหน้า Agent มีรูปแบบ `/character/{id}` [W06] เส้นทาง per-entity ของหมวดอื่นใน registry เป็นจุดเริ่มตรวจ ต้องยืนยันก่อนแสดงเป็นลิงก์รายละเอียด หากยังไม่ยืนยัน ให้ลิงก์หน้ารายการที่เข้าถึงได้และ raw JSON แทน

## E. ความสด/ข้อจำกัด

นี่คือ versioned HTTP JSON ไม่ใช่ stream real-time ไม่พบ SLA ของผู้ให้บริการที่รับประกันทุก field ตามเกมทันที; client cache settings ไม่ใช่เวลาอัปเดตฐานข้อมูล [C02]

ต้องแยก fetchedAt, cacheReadAt, response Last-Modified, manifest channel และ sourceUpdatedAt ที่ต้นทางระบุจริง ค่า delay500ms/maxRequests6000/หนึ่งworkerในชุดนี้เป็นนโยบายที่เราออกแบบ ไม่ใช่ limit ของ Nanoka

การเข้าถึงไฟล์ได้ไม่ได้หมายความว่ามีสัญญาบริการหรือสิทธิ์ mirror ทุก asset โดยไม่มีเงื่อนไข รักษาเครดิตและอย่าอ้างว่าเว็บ Sayari เป็นเว็บไซต์ทางการของ Nanoka หรือ HoYoverse
