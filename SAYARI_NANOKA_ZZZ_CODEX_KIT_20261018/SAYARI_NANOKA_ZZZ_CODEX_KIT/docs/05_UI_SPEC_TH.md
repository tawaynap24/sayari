# 05 — ข้อกำหนดหน้าแสดงข้อมูลทั้งหมด

เป้าหมายไม่ใช่แค่ developer console: คนทั่วไปเลือก Agent/อุปกรณ์/หมวดอื่นแล้วอ่านข้อมูลจริงได้ ส่วนคนพัฒนาเปิด raw/field/coverageได้ครบ

## โครงหน้า Database

**Header:** “ฐานข้อมูล Zenless Zone Zero” + source “Nanoka ZZZ” ที่คลิกได้ + badge snapshot/live-channel/latest-channel ตามจริง + version/build string + ภาษาข้อมูล

**Controls:** category, ค้นหาชื่อ/ID, version, locale, filterเฉพาะหมวดที่มีข้อมูลรองรับ, สถานะดาวน์โหลดของ historical versions และลิงก์กลับเครื่องคำนวณเดิม

**Overview:** จำนวน entity จาก index, detailพร้อมใช้/ทั้งหมด, failed/pending, จำนวน dataset, fetchedAt ของ snapshot พร้อมลิงก์ “ดูความครอบคลุมของข้อมูล” ห้ามเขียน100%ถ้ามีหมวดไม่ได้ตรวจ

**Content:** tabsหรือ navigation ตาม categoryจริง มี viewแบบอ่านง่ายและ API Explorer ไม่สร้างเมนูศัตรู/โหมดที่มีแค่mock หรือกล่องว่างโดยแอบซ่อนว่าไม่ดึงได้

## รายการและรายละเอียด

| หมวด | รายการ | sectionsของ detail |
|---|---|---|
| Agents | ภาพ ชื่อ ID rarity element specialty/faction ตามข้อมูล | Overview, Stats, Skills ทุกชนิด/ทุกระดับ, Core, Mindscape, Progression/Materials, Profile/Lore, Skin/Potentialเมื่อมี, Extra fields, Raw |
| W-Engines | ภาพ ชื่อ ID rarity specialty | Descriptions, Properties, ทุก Level/Stars/Refinement, Materials, Extra, Raw |
| Bangboo | ภาพ ชื่อ ID rarity | Stats, Skills a/b/c ทุกระดับที่มี, Progression/Materials/Extra, Raw |
| Drive Disc Sets | ภาพ ชื่อ ID | โบนัส2/4ชิ้น Story และทุก field ที่เพิ่มมา, Raw |
| Items | ชื่อ ID icon rank class | recordครบ, referencesไปจากmaterialsที่จับคู่ได้, Raw |
| หมวดเพิ่มเติม | สร้างจาก actual discovered dataset | structured presentationให้เหมาะกับshapeจริง + generic fallbackทุก field |

การเลือก level/refinement/skillไม่ใช่การตัดข้อมูลระดับอื่นทิ้ง ต้องเข้าถึงได้ทุกขั้น ถ้าไม่มีสูตรแปลงหน่วยที่ตรวจแล้วให้แสดง raw + format field ไม่ประดิษฐ์ค่าคำนวณ

## Reference และการระบุที่มา

ทุก record มี source blockที่มองเห็นได้ ไม่ใช่แค่footerเดียวไกลจากข้อมูล:

```text
ข้อมูลจาก: Nanoka — Zenless Zone Zero
Dataset: <category>     Record ID: <id>
Data version: <exact string>    Channel at fetch: Live / Latest / historical / unknown
Requested language: <lang>      Resolved language: <lang หรือ unknown>
Fetched at: <เวลาที่ดึง body จริง>
Read from local cache at: <เมื่อมี>
Source updated at: <เฉพาะต้นทางให้มา; ไม่ทราบเมื่อไม่มี>
Source JSON: <exact requested URL>
Nanoka reference: <verified page URL>
Status: Available / Partial / Failed / Cached snapshot
```

Source JSONต้องตรงกับrecord/locale/versionที่แสดง ถ้า deep linkของหมวดนั้นยังไม่ได้ตรวจ ให้ลิงก์category/homeที่ใช้ได้พร้อมระบุว่าไม่มี verified detail link ไม่สร้างลิงก์เดาแล้วกล่าวว่าถูกต้อง

ชื่อ/ข้อความภาษาไทยเป็น UIของ Sayari ข้อมูลอังกฤษ/ญี่ปุ่นฯไม่อ้างว่าถูกแปลไทยจาก Nanoka ถ้าเปลี่ยน requested locale แล้วใช้ fallback ต้องมีป้าย “ไม่มีข้อมูลภาษาที่เลือก — กำลังแสดง EN” พร้อมเก็บ requested/resolvedแยกกัน

## API Explorer

ต้องมี table ของทุก registered/observed resource: dataset, version, language, ID, source URL, HTTP/result, fetched/cache timestamps, bytes/hash และ errorถ้ามี

เปิด resource แล้วแสดง:

- structured summary + lazy JSON tree ที่เปิดทุก nodeได้
- JSON Pointerของค่าที่เลือก, exact key, data type, value รวม0/false/null/[]/{}
- raw textแบบไม่ตัดข้อมูล และปุ่มคัดลอก/ดาวน์โหลดต้นฉบับครบ
- field search + unknown fields + metadataของ source และ schema warnings

ตารางใหญ่มีpagination และ long arrayมีrange paging พร้อมจำนวนจริง ไม่ตั้งlimit100แล้วหายเงียบ ๆ การtruncateเพื่อperformanceต้องมีช่องทางโหลด/เปิดส่วนที่เหลือครบ

ถ้า unknown keyยังไม่มีlayoutสวย ให้มี “ข้อมูลเพิ่มเติมจาก API” แบบrecursive table/cards ไม่ทิ้งkey และไม่ส่งผู้ใช้ไปแกะ rawอย่างเดียว

## State ที่ต้องออกแบบจริง

Loading/skeleton; available; valid empty; failed HTTP; invalid JSON/HTML; partial dataset; missing detailแต่ยังมี index record; missing localized text; unknown enum; cache/stale snapshot; unknown sourceUpdatedAt; broken image; selected versionยังไม่sync; manifest schemaเปลี่ยน

อย่ารวม “request failed” กับ “ไม่มีตัวละคร” และห้าม0/default statsเพื่อกลบmissing data ใช้ `— / ไม่ทราบ / ไม่ได้รับข้อมูลจาก source` ตามกรณี

## Mobile/accessibility/performance

ตรวจขั้นต่ำ390×844, 768×1024, 1440×900; navigationใช้keyboardได้, focusชัด, labelสัมพันธ์input, imageมีalt และไม่บังชื่อเมื่อโหลดพลาด

ตารางกว้างเลื่อนในพื้นที่ของมันไม่ทำทั้งหน้าoverflow รูปlazyและจำกัดขนาดไม่layoutกระโดด รายการยาวแบ่งหน้า ไม่เร่งเปิดหลายbrowser workersพร้อมกัน

Screenshotsที่ส่งมอบต้องถ่ายจาก Sayari ที่รันจริง แสดงอย่างน้อยdatabase overview, agentdetail, อีกหนึ่งequipmentdetail, extra category, APIExplorer, mobile และpartial/error state

## ไม่ใช่ข้อกำหนดในงานนี้

ไม่ต้องทำ UID login/build import, player inventory, simulator Damage ใหม่, tier list, ranking, AI recommendations, เว็บอื่นหรือauth ไม่ต้องทำภาพใหม่ด้วยAI ใช้เกมassetที่sourceอ้างและการใช้งานที่ตรวจได้เท่านั้น
