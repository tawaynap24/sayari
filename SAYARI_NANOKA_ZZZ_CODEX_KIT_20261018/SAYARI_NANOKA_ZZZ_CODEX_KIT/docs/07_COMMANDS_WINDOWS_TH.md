# 07 — คำสั่งสำหรับ Codex บน Windows / PowerShell

คำสั่งต่อไปนี้อยู่ในชุดส่งต่อเพื่อให้ Codexรัน ไม่ได้หมายความว่าผู้ใช้ต้องทำเองทุกข้อ ตรวจว่าpathจริงตรงก่อนรัน ไม่ต้องเปิดสิทธิ์administrator

## ตั้งpathและตรวจruntime

```powershell
$root = 'D:\sayari-project'
$kit = Join-Path $root '_handoff\SAYARI_NANOKA_ZZZ_CODEX_KIT'
$cache = Join-Path $root '.nanoka'
Set-Location $root
node --version
npm.cmd --version
git status --short
```

สคริปต์แนบตั้ง minimum Node20 และผ่านการทดสอบofflineในNode22.16.0/Linux ไม่ได้ตรวจWindowsจากที่นี่ ใช้runtimeที่มีอยู่ถ้ารองรับ ไม่เปลี่ยนappdependenciesเพื่ออัปเกรดframework

## ตรวจZIPและunit testsของเครื่องมือ

```powershell
node "$kit\scripts\verify-kit.mjs"
node --test --test-concurrency=1 "$kit\tests\nanoka-sync.test.mjs"
```

`verify-kit` ตรวจไฟล์ในmanifestเท่านั้น ไม่รับรองupstreamหรือไฟล์dependencyที่ติดตั้งเพิ่มภายหลัง

## Baselineของแอป (ก่อนแก้และหลังแก้)

```powershell
npm.cmd run build
npm.cmd run lint
```

เก็บexit codeแต่ละคำสั่ง อย่ารันคำสั่งถัดไปแล้วรายงาน `$LASTEXITCODE`ของคำสั่งสุดท้ายแทนทั้งหมด ไม่จำเป็นต้องnpm installถ้าdependenciesพร้อมแล้ว

## Browser discovery

ใช้Codexbrowserที่มีอยู่ก่อน ถ้าต้องใช้สคริปต์แนบและมีPlaywrightพร้อม:

```powershell
node "$kit\tools\network-discovery\discover.mjs" --out "$cache\discovery" --channel msedge
```

`msedge`ใช้ได้เมื่อมีMicrosoft Edgeในเครื่องและPlaywrightรองรับจริง หากไม่มีให้ใช้ChromiumของPlaywright; อย่าฝืนไปใช้profileล็อกอินของผู้ใช้

ถ้าไม่มีmodule ให้ติดตั้งisolatedหลังตรวจversionที่npmregistryปัจจุบัน ไม่ต้องเพิ่มเป็นdependencyของSayari:

```powershell
$tool = Join-Path $kit 'tools\network-discovery'
$pwVersion = (npm.cmd view playwright version).Trim()
if ($LASTEXITCODE -ne 0 -or -not $pwVersion) { throw 'ตรวจเวอร์ชัน Playwright ไม่สำเร็จ' }
npm.cmd install --prefix "$tool" --save-dev --save-exact "playwright@$pwVersion"
# ใช้บรรทัดนี้เฉพาะเมื่อไม่ได้ใช้ browser channel ที่ติดตั้งแล้ว:
& "$tool\node_modules\.bin\playwright.cmd" install chromium
node "$tool\discover.mjs" --out "$cache\discovery"
```

การติดตั้งmodule/browserอาจใช้เน็ตและพื้นที่มาก จึงใช้เฉพาะเมื่อจำเป็น บันทึกversionที่ติดตั้งและlockfileของtool ไม่ลงglobal/ไม่upgradeapp

ผลobserverยังไม่ครบselectors ต้องอ่าน `observed-urls.json` และตรวจต่อในbrowserจริงตามdocs/03

## Probe — index/schema/count ก่อนfull run

```powershell
node "$kit\scripts\nanoka-sync.mjs" --mode probe --out "$cache" --channels live,latest --languages en,ja,ko,zh
```

ดู `.nanoka\latest-run.json`เพื่อหาrunDirล่าสุด จากนั้นอ่าน `plan.json`, `catalog.json`, `coverage.json` และ `requests.jsonl` ถ้าmanifestเข้าไม่ได้scriptจะไม่ประดิษฐ์versionให้

probeไม่โหลดทุกdetailจึงไม่ใช่ผลที่นำไปอ้างว่าดึงครบ ใช้ดูจำนวนrequestsที่วางแผนและการเปลี่ยนschema

## Full sync ของcore

```powershell
node "$kit\scripts\nanoka-sync.mjs" --mode sync --out "$cache" --channels live,latest --languages en,ja,ko,zh
```

ค่าเริ่มต้น: หนึ่งworker, delay500msระหว่างrequeststarts, timeout25s, สูงสุด3attempts, max6000networkattempts, max32MiBต่อresponse, cache24h ทั้งหมดเป็นlocalpolicyไม่ใช่Nanokalimit เพิ่มหรือลดได้ตามหลักฐาน/ขนาดงาน ไม่แก้เป็นunbounded

cacheใช้sameURL+verifiedhashและรักษาfetchedAtเดิม การรันซ้ำresumeจากcache ไม่ใช่networkverificationใหม่ทุกresource ใช้ `--refresh`เมื่อต้องการตรวจbodyจากต้นทางใหม่ (มีค่าrequestเพิ่ม)

## รวมAPIที่ค้นพบเพิ่ม

หลังCodexสร้างextensionจากหลักฐานจริงไว้ที่ `$cache\extensions.json`:

```powershell
node "$kit\scripts\nanoka-sync.mjs" --mode sync --out "$cache" --channels live,latest --languages en,ja,ko,zh --extensions "$cache\extensions.json" --observed "$cache\discovery\observed-urls.json"
```

อย่ารันโดยให้ไฟล์extensionsยังไม่มี และอย่าคิดว่าimportobservedURLsเท่ากับenumerateทุกrecordของหมวดนั้น ดูdocs/03

ถ้าbudgetไม่พอให้ดูจำนวนจริงแล้วขยายอย่างมีเหตุผล เช่น `--max-requests 10000`พร้อมคงdelay; ถ้ารับ429ลดความถี่เช่น `--delay-ms 1500` ไม่เพิ่มrequests/workerเพื่อฝืน429

## Exportเข้าVite public assets

รันเมื่อมีfull registeredscopeที่ตรวจแล้ว:

```powershell
node "$kit\scripts\export-for-vite.mjs" --out "$cache" --dest "$root\public\nanoka"
```

คำสั่งนี้ไม่deploy แต่เปลี่ยนไฟล์ที่จะเข้าbuildถัดไป เก็บsnapshotและsourceURLครบ ไม่ลบข้อมูลเก่าโดยอัตโนมัติ

Exporterจะปฏิเสธpartial/probeโดยปริยาย diagnosticเท่านั้นที่ใช้ `--allow-partial`ได้โดยแสดงpartialในUIชัดเจน ห้ามใช้เพื่อผ่านacceptance

## Historical version / refresh

```powershell
# แทนค่าภายในเครื่องหมาย <> ด้วยexactstringที่manifestมีจริงก่อนรัน:
node "$kit\scripts\nanoka-sync.mjs" --mode sync --out "$cache" --versions '<exact-version-from-manifest>' --languages en,ja,ko,zh
# ดึงใหม่จากต้นทางแทนcache:
node "$kit\scripts\nanoka-sync.mjs" --mode sync --out "$cache" --channels live,latest --languages en,ja,ko,zh --refresh
```

มี `--all-versions`สำหรับทุกavailableversion แต่ไม่ใช่defaultของงานนี้ ต้องประเมินจำนวนrequests/storageก่อน ถ้าexport historical-only run จะเปลี่ยนpointerให้เป็นsnapshotนั้น: แนะนำcollectioncatalogหลายsnapshotหรือคงlatestpublishedpointerไว้ ห้ามทำให้defaultLiveหายโดยไม่ตั้งใจ

## เปิดแอป/ตรวจbuildจริง

```powershell
npm.cmd run dev -- --host 127.0.0.1
# แยกอีกterminalเมื่อพร้อมตรวจdist:
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1
```

อ่านportที่Viteแสดงจริง ไม่อ้าง5173/4173หากถูกใช้งานแล้วและViteเลือกportใหม่ ตรวจroute `/game/zenless-zone-zero/database`พร้อมHomeและcalculatorเดิม

ไม่มีคำสั่งdeploy/commit/pushอยู่ในscope
