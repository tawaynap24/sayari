# 01 — บริบท Sayari จากเอกสารผู้ใช้

แหล่ง: `../input/SAYARI_PROJECT_SUMMARY.txt` เก็บต้นฉบับครบ ไม่มี source code ของ workspace แนบมาด้วย ดังนั้นรายการต่อไปนี้เป็นข้อเท็จจริงจาก snapshot ไม่ใช่ผลตรวจเครื่องล่าสุดของ Codex

| เรื่อง | สิ่งที่ snapshot ระบุ |
|---|---|
| Workspace | `D:\sayari-project` |
| App | React + TypeScript + Vite SPA, Material UI, React Router |
| Framework ที่ติดตั้ง | React18.3.1, Router6.25.1, MUI5.16.4, Vite5.3.4, TypeScript5.5.3 |
| Routes | `/` Home และ `/game/zenless-zone-zero` |
| Data | static constants, sample stats 4 cards; metadata26 agents ยังไม่ได้ใช้ในหน้าคำนวณ |
| Infrastructure | ไม่มี backend/database/auth/persistent application state; Firebase ใช้ Hosting |
| Scripts | dev, build (`tsc -b && vite build`), lint (warningsต้องเป็น0), preview |
| Tests | ไม่มี test script เดิม; snapshot ระบุ build/lint/initial render ผ่าน แต่ยังไม่ทำ browser/API/formula verification |
| Working tree | มี changes/untracked files มาก และอยู่ main ที่ติดตาม origin/main; ห้าม reset/clean |

จุดอ้างอิงในต้นฉบับ: หัวข้อ1–3 สำหรับ app/routes; หัวข้อ4–5 สำหรับ calculator; หัวข้อ7 สำหรับ Firebase; หัวข้อ8 และภาคผนวก D สำหรับ evidence/Git

## ไฟล์ที่ควรตรวจจริงก่อนแก้

`src/main.tsx`, `src/App.tsx`, `src/routes/route.tsx`, `src/routes/routeList.tsx`, `src/views/home/index.tsx`, `src/views/games/zenless-zone-zero/{index,card}.tsx`, `type.ts`, `data.ts`, `src/index.css`, `package.json`, lockfile, tsconfig/eslint/vite/firebase config

`Home` กับ `routeList` มี circular import ตามรายงาน ให้เพิ่ม route แบบไม่เติม module-level side effects รูปแบบ route registry จริงต้องอ่านจาก source ไม่เดา signature

## พื้นที่ที่ไม่ให้เปลี่ยนโดยแอบรวมงาน

สูตรใน `card.tsx` เป็น prototype มีปัญหา input/guard/การแสดงผลที่ snapshot บันทึกไว้ งานนี้ไม่รับรองหรือปรับสูตรเหล่านั้น

`TAgentStat.element` มี literal `ligntning` และ metadata ใช้ `Electric` อีก convention ให้ data adapter ของหน้าใหม่แยก namespace ไม่บังคับ API เข้า type เก่าเพื่อความสะดวก

metadata beta flags และภาพ `static.dotgg.gg` ในไฟล์เก่าไม่ใช่แหล่งข้อมูล Nanoka ที่ตรวจปัจจุบัน ห้ามนำมาอุดช่องว่าง API ใหม่แล้วติดป้ายว่าเป็น Nanoka

Firebase ไม่มี SPA rewrite ตาม snapshot; scoped rewrite สำหรับ BrowserRouter route ใหม่เป็นงานที่เกี่ยวข้องได้ แต่ไม่ deploy และไม่ตั้ง service ใหม่

## แยกการเปลี่ยนงานอย่างตรวจสอบได้

ก่อนแก้เก็บ git status/diff สรุปและ hash ไฟล์สูตรเดิม หลังแก้เปรียบเทียบซ้ำ ใช้ report folder ใหม่ ไม่เขียนทับรายงาน audit ของผู้ใช้ เก็บข้อมูล API จำนวนมากนอก src/bundle และไม่เพิ่มไฟล์ generated สุ่มลง Git โดยไม่ตรวจ .gitignore
