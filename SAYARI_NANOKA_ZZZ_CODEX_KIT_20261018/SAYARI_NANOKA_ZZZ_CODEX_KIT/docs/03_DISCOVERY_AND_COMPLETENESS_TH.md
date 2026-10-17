# 03 — Discovery และนิยาม “ทั้งหมด”

## ทำไม seed registry ไม่ใช่รายการทั้งหมด

Wrapper เป็นหลักฐานของ endpoints ที่ wrapper ใช้ ไม่ใช่แค็ตตาล็อกทุก feature ของ Nanoka หน้าเว็บมีหมวดเพิ่มเติม [C01,W01–W05] งานต้องค้นจากพฤติกรรมเว็บจริง แล้วขยาย registry จนหมวดที่มองเห็นทั้งหมดได้รับการจัดการ

## Scope matrix

| มิติ | ค่าเริ่มต้น/เกณฑ์ |
|---|---|
| Game/provider | ZZZ จาก Nanoka เท่านั้น |
| Versions | distinct `zzz.live` และ `zzz.latest` ของ manifest ที่ดึงจริง |
| Language | ทุก locale ที่ตรวจพบและใช้ได้ เริ่มตรวจ en/ja/ko/zh |
| Categories | ทุก public dataset ที่ยืนยันได้จาก index/Network/public source ของเว็บ |
| Records | ทุก ID/season/stage/group ที่ source index เปิดเผย |
| Fields | ทุก key, nested object/array, null/false/0/empty และ unknown field |
| Assets | URL/metadata และภาพที่แสดงในหน้า; ไม่ mirror binary ทั้ง CDN |
| Historical | แสดงรายการ available; sync รุ่นเก่าเมื่อเลือก/สั่งโดยชัดเจน |
| ไม่อยู่ใน scope | ผู้เล่น/UID, private endpoint, credential, เกมอื่น, hidden unadvertised CDN files |

## ขั้นตอน discovery

1. เปิดหน้า root แล้วตรวจรายการเมนูจริง เทียบ `reference/discovery-review.template.json` เพิ่มเมนูที่ยังไม่มี ห้ามลดรายการเพราะ wrapper ไม่มี method
2. Capture Network ก่อนเข้าแต่ละหมวด และก่อนเปลี่ยน tabs/language/version/season/filter ที่อาจโหลดชุดใหม่ บันทึก GET JSON responses จริงพร้อม page origin
3. เปิด detail อย่างน้อยหนึ่งรายการต่อโครงสร้างเพื่อหารูปแบบ endpoint จากหลักฐาน แล้วหา **index ที่ enumerate ทุก ID ได้** ไม่ใช้ ID sample เป็น roster
4. ตรวจ API response จริงว่าเป็น dictionary, array, wrapper object, SSR serialized graph หรือ local computed result แล้วสร้าง adapter ที่ตรง
5. อัปเดต extension และรัน full sync ทั้ง family อย่าหยุดหลัง raw exact URLs ที่ observer พบไม่กี่รายการ
6. เทียบ request coverage กับหมวดของเว็บและ scope matrix ปิด unresolved เฉพาะที่มีหลักฐานแล้ว

ถ้าไม่พบ standalone API ให้บันทึกว่า “ยังไม่พบ/ไม่มีแยกตามการตรวจนี้” พร้อม Network/source evidence ไม่อ้างว่า API ไม่มีจากการเรียก URL เดาแล้วได้404

## ตัวช่วย Network ที่แนบ

`tools/network-discovery/discover.mjs` ใช้ Playwright ฟัง response events [T01] เข้า known routes, top-level internal links และตัวอย่าง detail ต่อ route family เก็บ JSON ที่สังเกตได้และรายการ controls ที่ต้องตรวจเพิ่ม โดยไม่ใช้ข้อมูลล็อกอิน

ข้อจำกัดตั้งใจ: bounded maxPages, ไม่เปลี่ยนทุก selector อัตโนมัติ, ไม่รับรองทุก locale/version, ไม่ enumerate ทุก detail จึงให้สถานะ `AUTOMATIC_CAPTURE_ONLY_REQUIRES_MANUAL_SELECTOR_AND_FAMILY_REVIEW` เสมอ Codex ต้องดำเนินการส่วนที่ยังเหลือต่อ

เมื่อพบ403/401/429 ให้หยุดข้ามการป้องกัน บันทึก blocker ห้ามนำ proxy หรือ session ของผู้ใช้มาเลี่ยงระบบ

## การเพิ่ม dataset ลง registry

ใช้ `reference/extensions.template.json` เป็นจุดเริ่ม รูปแบบ object ต้องมี:

```json
{
  "key": "ชื่อหมวดที่ตรวจแล้ว",
  "label": "ชื่อแสดงผล",
  "required": true,
  "localizedIndex": false,
  "recordsPointer": "",
  "idField": "id",
  "idPattern": "^[0-9]+$",
  "indexPath": "ใส่ actual path หลังพิสูจน์แล้วเท่านั้น",
  "detailPath": null,
  "localizedDetail": false,
  "referenceList": "https://zzz.nanoka.cc/",
  "referenceDetail": null,
  "evidence": {
    "kind": "browser_observed",
    "sourceUrl": "https://zzz.nanoka.cc/",
    "evidenceFile": "ตำแหน่งหลักฐานจริง"
  }
}
```

ตัวอย่างด้านบนเป็น **schema guide ที่รันไม่ได้จนกรอก actual endpoint** ไม่ใช่ API ที่กล่าวว่ามีจริง ต้องใช้ key ที่เป็น ASCII [A-Za-z0-9_-] ในไฟล์ executable registry

`indexPath` และ `detailPath` ของ collector ต้องเริ่ม `/zzz/` รองรับ `{version}`, `{lang}`, `{id}`; ตั้ง `localizedIndex`/`localizedDetail` ให้ตรง path ถ้า index data อยู่ใต้ wrapper ให้ใช้ `recordsPointer` เช่น `/data` **เฉพาะเมื่อเห็น key นั้นจริง**

DetailPath เป็น null สำหรับหมวดที่ข้อมูลทั้งหมดอยู่ใน index ไฟล์เดียว ไม่มีเหตุผลให้ทำ N detail calls เพิ่มโดยเดาเส้นทาง

ถ้า framework payload ไม่อยู่ในรูปแบบนี้ ใช้ `rawUrls` ที่มี exact URL+evidence เก็บ raw ก่อน จากนั้น Codex ต้องปรับ collector/adapter อย่างมีหลักฐาน ไม่อ้างว่า schema ของ seed ครอบคลุมทุก endpoint

## Observed URLs ไม่เท่ากับ enumeration

`--observed` เพิ่ม exact successful JSON URLs จาก observer เข้า run และ deduplicate URL ที่ core ดึงแล้ว โดยไม่ขยาย path ตามการเดา Unknown-version URLs ไม่ถูกผูกกับ live เอง

หลัง import ยังต้องวิเคราะห์ว่าแต่ละ request เป็น list/detail/locale/season family หรือไม่ แล้วเพิ่ม registry ให้ดึงครบ records ที่เหลือ พร้อม provenance ว่า unversioned response เป็นข้อมูล observed ณ เวลาใด ห้ามป้ายเป็น patch ที่ไม่รู้

## จำนวนคำขอ core ที่คาดหมาย

สำหรับแต่ละ distinct version v ให้ C/W/B/D เป็นจำนวน IDs ใน index ของ Agent/Weapon/Bangboo/Disc และ L เป็นจำนวนภาษาที่เลือก:

```text
1 manifest + ผลรวมทุก version ของ [4 indexes + L item dictionaries + L × (C + W + B + D) details]
```

นี่เป็นสูตรประเมินสำหรับ seed ที่สำเร็จครบ ไม่รวม retry, extra categories, browser requests หรือ cached skips ถ้า index ล้มเหลว จำนวน descendants คือ **unknown** ไม่ใช่0

## เกณฑ์นับความครบ

รายงานอย่างน้อย 4 ชั้นแยกกัน:

1. **Discovery coverage:** ตรวจเมนู/แท็บ/ตัวเลือก/family ครบหรือยัง
2. **Resource coverage:** expected URLs ตาม registry = fetched/cached success + failed + pending (ทุกส่วนมีรายการ)
3. **Entity coverage:** index IDs ที่คาดหมาย = detailพร้อมใช้ + unavailable พร้อมเหตุผล ห้ามกรองIDออกเพื่อให้เปอร์เซ็นต์ดีขึ้น
4. **Field/UI coverage:** ทุก field มี structured view หรือ accessible generic fallback พร้อม raw ต้นฉบับ

Collector ตั้ง `entireProviderApiComplete:false` โดยตั้งใจ แม้ registry ดึงครบ เพราะโปรแกรมไม่ได้พิสูจน์ว่าเว็บไม่มีหมวดอื่นให้ค้นพบ นี่ไม่ใช่ bug ให้ลบออกเพื่อทำรายงานเขียว

Discovery sign-off ต้องเก็บไฟล์จริงที่อ้างใน review, ทุก route มีผลตรวจ, selectorsทุกตัวในscopeได้รับการจัดการ, additional routes ไม่มีค้าง, unresolvedมีเหตุผลที่ชัดเจน และ extra detail families ถูก enumerate แล้ว

สถานะผลรวมที่ Codex ใช้: `READY_FOR_USER_VISUAL_REVIEW` เมื่อ ingest/discovery/UI ผ่านพร้อมหลักฐาน; `PARTIAL_DATA_COVERAGE` ถ้าข้อมูลบางหมวดไม่ครบ; `BLOCKED_UPSTREAM_ACCESS` ถ้าเข้าไม่ได้; `IMPLEMENTATION_WITHOUT_LIVE_VERIFICATION` ถ้าทำโค้ด/ทดสอบofflineแล้วแต่ไม่มีผลจริง ห้ามยกระดับจาก unit test เป็น live pass
