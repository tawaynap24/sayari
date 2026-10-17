# Nanoka public source discovery

Run: 2026-10-17T18-43-20-900Z-a22a7754

ตรวจ root และ 13 navigation families จาก URL จริง ทุกหน้าที่ capture มีผล HTTP ตาม observed-urls.json ตรวจ global selectors 2 channels × 4 locales, Overview/Story/Gallery, Hollow ทั้ง 4 tabs, comparison controls, local category filters และ simulation stage buttons

Canonical endpoint templates อยู่ tools/nanoka/reference/extensions.json แต่ละรายการมี observed URL/page/time ไม่เดา ID; details ทุก ID ตรวจใน ENDPOINT_COVERAGE.json

Observed successful JSON URLs ที่ยังไม่อยู่ใน catalog: 0

Framework __data.json มี locale, enableBgShadow, dataVersion เป็น UI preferences เก็บ raw โดยไม่ระบุ version/locale ของ resource; game data ใช้ versioned static resources ที่ตรวจพบจริง

ขอบเขตไม่รวม personal achievement completion, account/UID, historical builds ที่ไม่ได้เลือก และ binary ทั้ง CDN ไม่ใช้ credentials ของผู้ใช้ และไม่ bypass 401/403/429

หลักฐาน Network ทุกไฟล์อ้าง body ที่ตรวจ SHA-256 แล้วใน discovery-bodies/
