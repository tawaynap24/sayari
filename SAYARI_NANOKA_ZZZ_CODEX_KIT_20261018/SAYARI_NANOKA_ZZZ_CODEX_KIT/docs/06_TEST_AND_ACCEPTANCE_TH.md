# 06 — Tests, evidence และ acceptance

## 1. แยกประเภทหลักฐาน

`evidence/` ใน ZIP เป็นผลเตรียมชุดเครื่องมือเท่านั้น Testsใช้synthetic fixturesและไม่ยืนยันAPIจริง ส่วน Codex ต้องสร้าง evidenceใหม่ในworkspaceและแยก live data, mock unit tests, build, browserแต่ละประเภท

ห้ามนำ `REGISTERED_SCOPE_COMPLETE` จากtest fixtureไปนับเป็น live coverage และห้ามใช้screenshotต้นทางNanokaแทนสกรีนช็อตแอป

## 2. Checklist รับงาน

| ID | เงื่อนไข | หลักฐานขั้นต่ำ |
|---|---|---|
| BASE-01 | ไม่ล้างworking tree/แก้สูตรเดิม | ก่อน-หลังgit status/diffและhash calculator |
| API-01 | manifestจริง/เวอร์ชันไม่hardcode | originalbody+URL+time+hash |
| API-02 | coreทุกindexและdetailIDครบตามscope | expected/success/missing counts และrequestlog |
| API-03 | locales+Live/Latestถูกต้อง | matrixต่อversion/locale ไม่ปนpayload |
| API-04 | หมวดนอกwrapperได้รับการตรวจครบ | discovery-reviewพร้อมNetwork/sourceหลักฐานจริง |
| API-05 | extra detail familyไม่หยุดแค่sample | index IDsเทียบfetchedIDsและรายการmissing |
| API-06 | error/throttle/budgetไม่ถูกนับสำเร็จ | tests + errorรายการจริงเมื่อเกิด |
| DATA-01 | rawไม่เปลี่ยน/unknownfieldไม่หาย | hashes+raw storage+field inventory |
| DATA-02 | source/provenanceไม่ปลอม | compareURL/version/locale/fetch metadataของrecord |
| DATA-03 | snapshotไม่ถูกเรียกreal-time | UIlabelและrefreshbehaviorตรงarchitecture |
| UI-01 | ทุกหมวดมีรายการ+structureddetail | browser testsและscreenshots |
| UI-02 | fieldทุกชนิดเข้าถึงได้ | leaf coverage/unknown-field renderer tests |
| UI-03 | JSONExplorerครบและdownloadได้เต็ม | raw bytesเทียบhash/ขนาด |
| UI-04 | เปลี่ยนlocale/version/filter/deeplinkได้ | browser interaction tests |
| UI-05 | มือถือ/keyboard/error/brokenimage | screenshotsและtest results |
| REG-01 | Home/เครื่องคำนวณเดิมยังทำงาน | browserregression ไม่ใช่เพียงSSR |
| BUILD-01 | build/lintจริงผ่านไม่มีwarning | command+exit code+stdout |
| HOST-01 | deep linkและJSONในdistถูกต้อง | preview/hosting-emulatorหรือข้อจำกัดที่ระบุ;ไม่อ้างproductionถ้าไม่deploy |

## 3. Unit tests ที่แนบและที่ต้องเพิ่ม

แนบ tests สำหรับ selection/encoding/IDs/unknown values/URLallowlist/rawbyte/cache/403/429/budget/invalidJSON/maxbody/fullenumeration/publish safeguards ใช้fetch mocksเฉพาะtests

Codexต้องเพิ่ม testsของadaptersและUI เช่น:

- raw → projection ไม่แก้input และทุกsourcekeyอยู่ในstructuredหรือExtraFields
- รูปและdeep linkไม่เดา ID; unsafe URL/textไม่execute
- null/false/zero/emptyกับmissingไม่ถูกปน; original Tagsไม่หาย
- localefallbackเปิดเผย; responseของversionเก่าไม่ทับcurrentview
- numberเกินsafeintegerไม่แสดงค่าปัดอย่างเงียบ
- materialId lookupไม่พบยังเห็นIDและwarning
- longarray/pagination/expandเข้าถึงรายการสุดท้ายได้
- expected entity set = fetched usable set + explicit unavailable set; unknown descendantsไม่ตีเป็น0

ใช้workerเดียวเป็นค่าเริ่มต้น และreusebrowserไม่เปิดหลายตัวโดยไม่จำเป็น

## 4. Field coverage ที่ตรวจได้

สร้าง `field-coverage.json` จากsource JSONจริง: resourceURL, version/locale, node/leaf counts, mappedpaths, genericfallbackpaths, droppedpaths ต้องไม่มีdroppedpathsโดยไม่มีเหตุผลที่ผู้ใช้อนุมัติ

ไม่จำเป็นต้องแสดงทุกfieldบนDOMพร้อมกันเพื่อผ่าน แต่ทุกpathต้องมีวิธีเข้าถึงผ่านstructured/generic viewer และมีrawdownloadที่เก็บครบ ใช้JSONPointerescapingถูกต้องสำหรับkeyที่มี `/` หรือ `~`

การทดสอบชิ้นตัวอย่างแต่ละcategoryใช้ตรวจUI/meaning ส่วนการตรวจraw hashes/IDs/fieldsทำกับทุกresourceในscope ไม่เรียกการสุ่มว่าcomplete audit

## 5. รูปแบบหลักฐานที่ Codex ต้องส่ง

```text
evidence/nanoka-zzz/<timestamp>/
  BASELINE.md
  WORKTREE_CHANGES.md
  SOURCE_DISCOVERY.md
  discovery-review.json
  observed-urls.json
  ENDPOINT_COVERAGE.json
  FIELD_COVERAGE.json
  TEST_RESULTS.json
  build.log
  lint.log
  unit-tests.log
  browser-tests.log
  screenshots/
  FINAL_REPORT_TH.md
```

Rawobjects/runreportsอยู่ `.nanoka/`ได้แต่finalreportต้องชี้pathที่มีอยู่จริง ถ้าอ้างไฟล์evidenceต้องตรวจว่าไฟล์นั้นถูกสร้างแล้วและไม่ใช่ชื่อplaceholder

## 6. สถานะสุดท้าย

**READY_FOR_USER_VISUAL_REVIEW:** ทำตามscope/discovery/UIแล้ว มี live verificationและcoverageจริง ไม่อ้างว่ารู้private/hiddenendpointsทั้งหมดของผู้ให้บริการ

**PARTIAL_DATA_COVERAGE:** ยังมีlocale/index/entity/category/fieldที่ไม่ครบ ระบุaffectedscope, counts, errorและแผนต่อ ไม่ใช้100%รวมทั้งระบบ

**BLOCKED_UPSTREAM_ACCESS:** sourceเข้าไม่ได้ ระบุ URL/status/networkerrorและวันเวลา ไม่แปลอุปสรรคของเครื่องนี้ว่า APIเลิกให้บริการทั่วโลก

**IMPLEMENTATION_WITHOUT_LIVE_VERIFICATION:** โค้ดและofflinetestsพร้อมแต่ยังไม่มีAPIจริง/ไม่ผ่านbrowserจริง แยกออกจากready

หลักการสำคัญ: errorที่อธิบายได้ยังเป็นerror ไม่ใช่successเพราะเขียนรายงานครบ และรายการdataที่ไม่สามารถเรียกได้ต้องยังมองเห็นในcoverageแม้ UIแสดงส่วนอื่นได้ดี
