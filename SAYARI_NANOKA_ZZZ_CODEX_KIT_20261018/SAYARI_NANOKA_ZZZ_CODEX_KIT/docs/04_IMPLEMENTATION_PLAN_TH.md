# 04 — แผน implement ในโปรเจกต์เดิม

ส่วนนี้เป็นข้อกำหนดการออกแบบ Sayari ที่เสนอในชุดงาน ไม่ใช่รูปแบบ infrastructure ของ Nanoka

## Architecture ที่เข้ากับ snapshot ปัจจุบัน

```text
Nanoka public JSON + actual website Network
            ↓ local Node sync / discovery โดย Codex
.nanoka/objects/<sha256>.json             ข้อมูลดิบ ไม่แปลงทับต้นฉบับ
.nanoka/runs/<runId>/catalog.json         URL → file + version + locale + provenance
.nanoka/runs/<runId>/coverage.json        expected/success/failure/schema issues
            ↓ ตรวจและ export snapshot
public/nanoka/current.json               pointer ของ snapshot ที่เผยแพร่ใน build นี้
public/nanoka/snapshots/<runId>/...
            ↓ Vite build/Firebase static hosting เดิม
React Database → catalog/index → lazy detail → structured view + raw explorer
```

โครงนี้ไม่ต้องเพิ่ม server/auth/database เพื่อให้หน้าเว็บแสดงข้อมูลที่ Codex ดึงจริง แต่ต้องติดป้ายว่าอ่าน snapshot ไม่ใช่ live upstream API

## ไฟล์/โมดูลที่เสนอ

ตรวจ convention ใน source ก่อนใช้ชื่อเหล่านี้ ไม่บังคับย้าย source เดิม:

```text
src/features/nanoka/
  types.ts                  JSON value, provenance, source resource, dataset config
  catalogClient.ts          โหลด current/catalog/raw resource จาก snapshot URL
  sourceLinks.ts            validate source URLs และ entity links ที่ตรวจแล้ว
  adapters/                 projections ของแต่ละ category โดย raw ยังอยู่ครบ
  hooks/                    cache + cancellation + stale-response guard
  components/
    SourceReference.tsx     source/version/language/fetch/cached badges
    DatasetStatus.tsx       success/partial/error ไม่ปลอม empty
    JsonTree.tsx            lazy expandable tree, JSON Pointer, copy/download
    ExtraFields.tsx         unknown-field fallback ไม่ทิ้งข้อมูล
    ...
src/views/games/zenless-zone-zero/database/
  index.tsx                 Database/Explorer route entry
```

MUI5 ที่มีอยู่พอสำหรับ Table/Tabs/Card/Accordion/Chip/Alert/Skeleton/Pagination ไม่จำเป็นต้องติด MUI X/DataGrid หรืออัปเกรด UI framework

## Data contract

ใช้ `reference/ui-data-contract.ts` เป็นจุดเริ่ม ไม่ cast `response.json()` เป็น interface สมบูรณ์โดยไม่ตรวจ schema

แยก `rawText` (original bytes decoded), parsed `JsonValue` (สำหรับ tree), normalized projection (สำหรับ structured UI) และ `SourceResource` (provenance) อย่านำ normalized object ไปบันทึกทับ raw

String IDs ไม่แปลงเป็น number ใช้ composite key `version + dataset + locale + id` ไม่ใช้ชื่อ agent เป็น primary key ตัวละครชื่อคล้ายกัน/หลายเวอร์ชันต้องไม่ชนกัน

ตรวจ number ที่เกิน JS safe integer: raw string ยังรักษาค่าเดิมแต่ JSON.parse อาจปัด ห้ามแสดง parsed number ว่า exact ถ้าตรวจพบ ให้ใช้ lossless parser/lexical number handling ที่เหมาะสมพร้อม tests หรือระบุ inability ของ structured numeric field แล้วให้ exact raw view โดยไม่ปิดบัง

## Loading และ cache

อ่าน current.json/catalog ก่อน ไม่ดึง detail ทุกตัวตอน React mount ใช้ index สำหรับรายการ แล้ว fetch raw detail ตามรายการที่เปิด ภาษาหรือ version เปลี่ยนต้อง invalidate request key และป้องกัน response เก่าทับ state ใหม่

React StrictMode อาจทำ lifecycle ซ้ำ จึงควร deduplicate in-flight fetch/ใช้ cleanup ไม่ยิง sync upstream ทุก effect

เก็บเฉพาะ current view/รายละเอียดที่เพิ่งดูใน memory อย่างมีเพดาน หน้าใหญ่ใช้ pagination/lazy expansion ไม่กาง JSON ทุกภาษา/ทุก record ใน DOM พร้อมกัน

`current.json` reload ต้องไม่ติด cache จนเลือก snapshot ใหม่ไม่ได้ แต่ไม่เติม random cache-buster ทุก resource JSON ที่ content-addressed แล้ว

## การ sync/publish ที่ไม่หลอกว่า real-time

Collector สร้าง run ใหม่และรักษา raw objects เดิม Exporter ตรวจ SHA-256 แล้วเขียน snapshot files ก่อนเปลี่ยน pointer โดยไม่ลบ snapshot เดิม และไม่ build/deploy เอง

snapshot ที่ probe อย่างเดียวหรือยังล้มเหลวจะถูก exporter ปฏิเสธโดยปริยาย `--allow-partial` ใช้ได้เฉพาะ diagnostic ที่ติดป้าย partial ทั้งหน้า ห้ามใช้เพื่อทำ acceptance เขียว

หลัง full sync อ่าน manifest ซ้ำจริงแบบไม่ใช้ cacheเพื่อตรวจ channel เปลี่ยนระหว่างรันหรือไม่ ถ้าเปลี่ยนให้บันทึกและตัดสิน syncเวอร์ชันใหม่เป็นชุดแยก ไม่เอา metadataใหม่แปะให้ข้อมูลเก่า สิ่งนี้ต้องเสริมใน workflow ของ Codex; collectorไม่อ้างว่าแหล่งข้อมูลเป็น transactional snapshot

หน้าเว็บที่ไม่มี backend ไม่สามารถกดปุ่มแล้วสั่ง Node collector บนเครื่องของผู้ใช้/ผู้พัฒนาได้ ปุ่มใน production จึงใช้ชื่อ “โหลด snapshot ที่เผยแพร่ล่าสุด” ไม่ใช่ “sync Nanoka ทั้งหมดตอนนี้” เว้นแต่ implement เส้นทางการอัปเดตจริงพร้อมหลักฐาน

## Browser direct fetch และ CORS

เป็นทางเลือกเฉพาะเมื่อทดสอบจริง ไม่ใช่ assumption เครื่องมือ Node เรียกได้ไม่ได้ยืนยันว่า browser เรียกได้ และ headerที่อ่านได้จาก Node ไม่เท่ากับ browser verification

ถ้าใช้ proxy ของ Vite ใน dev อย่ารายงานว่าจะแก้ Firebase productionด้วยโดยอัตโนมัติ ห้ามใช้ no-cors แล้วพยายามอ่าน opaque response

`VITE_` variables จะออกไปใน client bundle [T03] แม้ endpointหลักไม่ต้อง key ก็อย่าฝัง credentialsจาก APIอื่นหรือไฟล์ .env ของผู้ใช้

## Routes/Firebase

รักษาหน้าเดิม `/` กับ `/game/zenless-zone-zero`; เพิ่ม `/game/zenless-zone-zero/database` ส่วน category/version/lang/id ใช้ query หรือ subrouteตาม conventionจริง

ถ้าใช้ BrowserRouter และ Firebase configยังไม่มี SPA fallback อาจเพิ่ม rewrite แบบ scopedตามเอกสาร [T02] เช่น catch-allไป index.html **หลังตรวจ rulesเดิม** โดยรักษาการเสิร์ฟไฟล์ JSON จริงและไม่ให้ missing .json กลายเป็น HTML200แล้วถูกนับว่าข้อมูลสำเร็จ clientต้องตรวจ parse/content typeด้วย

ไม่ deploy ไม่เปลี่ยน Firebase project ID ไม่เปิด Functions/Auth/Firestore และไม่ใช้ Firebase welcome scaffoldingนอก public build
