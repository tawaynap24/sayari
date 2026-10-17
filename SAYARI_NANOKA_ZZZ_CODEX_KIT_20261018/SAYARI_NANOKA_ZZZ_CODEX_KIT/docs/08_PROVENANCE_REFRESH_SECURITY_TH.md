# 08 — ที่มา ความสดของข้อมูล และความปลอดภัย

## เก็บอะไรต่อresource

URLต้นทางแบบexact, dataset, ID, versionstring, channelที่manifestชี้ตอนดึง, requested/resolvedlocale, HTTPstatus, fetchresult, fetchedAtจริง, cacheReadAt, bytes, SHA-256, sourcepageที่ยืนยัน, responseETag/Last-Modified/Cache-Control/Ageเมื่อมี และschema/errors

ถ้าsourceไม่บอกsourceUpdatedAtให้null/“ไม่ทราบ” อย่าเอาเวลาปัจจุบัน/fetchedAt/วันที่buildมาแทน ห้ามอ้างว่าETagหรือHTTPDateคือเวลาอัปเดตตัวละครในเกม

Collectorเก็บheadersที่เกี่ยวข้องเฉพาะallowlist ไม่บันทึกSet-Cookie/Authorization Browserobserverไม่ใช้loginไม่บันทึกHARเต็มที่อาจมีcredentials

## ไม่รับประกันreal-time

Versionedfilesอาจอัปเดตตามงานของผู้ดูแล และอายุcacheแต่ละชั้นไม่ใช่freshnessSLA ไม่มีเหตุผลให้pollรายละเอียดทุกตัวต่อวินาที [C02]

แยก “ดึงจากNanokaเมื่อ”, “อ่านcacheเมื่อ”, “publishsnapshotเมื่อ”, “เวอร์ชันข้อมูล” และ “เวลาแก้sourceที่ทราบจริง” ใช้labelตรงกับข้อเท็จจริง

หน้าเว็บที่อ่านpublicsnapshotแสดง “ข้อมูลsnapshot” เสมอ ถ้ามีdirectbrowserAPIเพิ่มเติมให้แยกprovider/mode; อย่าผสมfallbackโดยเปลี่ยนเพียงข้อความlastupdatedให้ดูใหม่

## เงื่อนไขข้อมูลไม่พร้อม

404ของentityที่indexยังอ้าง: เก็บindexrecordและmissingdetail ไม่dropให้countsเท่ากันโดยปลอม

401/403/CAPTCHA: หยุดoriginและบันทึกblocker ไม่ใช้บัญชีผู้ใช้หรือเปลี่ยนIPเพื่อเลี่ยง

429: เคารพRetry-After, ลดความถี่, checkpoint ไม่retryไม่จำกัด

HTTP200แต่HTML/errorpayload: ไม่นับเป็นAPIสำเร็จ Parse/schemaที่ตรวจไม่ผ่านต้องแสดงwarning/error ไม่ทำ `catch(() => [])`เพื่อกลบ

Manifest/indexไม่สำเร็จ: expecteddescendants=unknown ไม่ใช่0; ส่งมอบโค้ดที่จัดการerrorได้แต่ไม่อ้างverifieddata

## Content safety / XSS

ข้อมูลภายนอกเป็นuntrustedtext Reactrenderเป็นtextโดยปริยาย ไม่ใช้eval/Functionและไม่ฉีดHTMLตรงด้วยdangerouslySetInnerHTML ถ้าต้องรองรับformatในคำอธิบายให้ใช้parser/sanitizerที่ตรวจแล้ว พร้อมคงrawtextและtestmaliciousmarkup

Sourceและassetlinksต้องvalidateprotocol+origin อนุญาตhttpsNanokaที่ตรวจจริง ไม่เปิดjavascript/dataURLsตามpayloadและใช้rel=noopener noreferrerเมื่อtarget_blank

ไม่mergepayloadเข้าobjectprototypeแบบunsafe ระวัง__proto__/constructor/prototype ใช้Map/Object.create(null)/ownpropertychecksตามเหมาะสม

## ขอบเขตlicense/branding

ให้creditNanokaZZZและระบุSayariเป็นแอปของผู้ใช้ ไม่กล่าวว่าเป็นผลิตภัณฑ์ทางการของNanoka/HoYoverse ไม่มีAPIkeyในclientที่ตรวจไม่ใช่ใบอนุญาตนำassetไปใช้ทุกแบบ [N01,C01]

ก่อนpublicreleaseตรวจterms/การใช้ภาพปัจจุบัน ไม่mirrorbinaryทั้งหมดหรือโคลนUI/โลโก้เพื่อทำให้ผู้ใช้เข้าใจผิด ไม่ต้องซื้อบริการในงานนี้

## แหล่งอ้างอิงและการตรวจซ้ำ

`reference/sources.json`แยกprimarysite, clientsource, website-searchobservationและofficialtechnicaldocs บางsourceมาจากbranchmainซึ่งเปลี่ยนได้ Codexควรบันทึกcommit/hash/versionที่ตรวจจริงเมื่อทำimplementation ไม่มีcommitSHAสมมติในชุดนี้

`evidence/PREPARATION_STATUS.json`ระบุสิ่งที่ทำได้/ทำไม่ได้จากที่นี่ ตรวจofflineunitresultsแยกจากupstreamavailabilityและprojectbuild/UI results
