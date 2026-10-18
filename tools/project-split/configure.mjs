import fs from 'node:fs';
const read = file => fs.readFileSync(file, 'utf8');
const write = (file, text) => fs.writeFileSync(file, text);
const json = file => JSON.parse(read(file));
const save = (file, value) => write(file, JSON.stringify(value, null, 2) + '\n');
const edit = (file, replacements) => {
  let text = read(file);
  for (const [from, to] of replacements) text = text.replaceAll(from, to);
  write(file, text);
};
for (const app of ['zzz', 'timeline']) {
  const pkg = json(`${app}/package.json`);
  pkg.name = app;
  pkg.devDependencies.playwright = '1.64.1';
  if (app === 'zzz') {
    for (const key of Object.keys(pkg.scripts)) if (key.startsWith('timeline:')) delete pkg.scripts[key];
    for (const key of ['firebase', 'fflate', 'pdfjs-dist', 'zod']) delete pkg.dependencies[key];
    for (const key of ['firebase-tools', '@firebase/rules-unit-testing', 'tsx']) delete pkg.devDependencies[key];
    delete pkg.scripts['localization:report'];
    Object.assign(pkg.scripts, {
      dev: 'vite --host 127.0.0.1 --port 5173 --strictPort',
      test: 'npm run nanoka:test && npm run localization:test',
      'test:calculator': 'node tools/calculator/preservation.mjs',
      'test:browser': 'node tools/nanoka/tools/network-discovery/localization-tests.mjs',
    });
    edit(`${app}/tsconfig.app.json`, [['["src", "functions/src/domain"]', '["src"]']]);
  } else {
    for (const key of Object.keys(pkg.scripts)) if (key.startsWith('nanoka:') || key.startsWith('localization:')) delete pkg.scripts[key];
    delete pkg.scripts['timeline:verify'];
    for (const key of ['@emotion/react', '@emotion/styled', '@mui/material']) delete pkg.dependencies[key];
    Object.assign(pkg.scripts, {
      dev: 'vite --mode emulator --host 127.0.0.1 --port 5174 --strictPort',
      'build:emulator': 'npm run timeline:build',
      'build:functions': 'npm run timeline:functions',
      test: 'npm run timeline:unit',
      'test:emulators': 'npm run timeline:test',
      'test:integration': 'node tools/timeline/integration.mjs',
      'test:browser': 'node tools/timeline/browser.mjs',
      emulators: 'npm run timeline:emulators',
      seed: 'npm run timeline:seed',
      check: 'node tools/timeline/checks.mjs',
    });
  }
  save(`${app}/package.json`, pkg);
  const lock = json(`${app}/package-lock.json`); lock.name = app; lock.packages[''].name = app; save(`${app}/package-lock.json`, lock);
  edit(`${app}/index.html`, [['lang="en"', 'lang="th"'], ['    <link rel="icon" type="image/svg+xml" href="/vite.svg" />\n', ''], ['Vite + React + TS', app === 'zzz' ? 'Zenless Zone Zero' : 'Timeline']]);
  write(`${app}/vite.config.ts`, `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  optimizeDeps: { entries: ['index.html'] },\n  server: { watch: { ignored: ['**/.nanoka/**', '**/.timeline/**', '**/functions/lib/**', '**/evidence/**', '**/tools/**', '**/public/nanoka/**', '**/public/localization/**'] } },\n})\n`);
  edit(`${app}/.eslintrc.cjs`, [["'SAYARI_NANOKA_ZZZ_CODEX_KIT_20261018', '_handoff', ", '']]);
}
write('zzz/src/routes/routeList.tsx', `import Home from '../views/home';\nimport ZenlessZoneZero from '../views/games/zenless-zone-zero';\nimport DatabaseRoute from '../views/games/zenless-zone-zero/database/route';\n\nexport const routeList = [\n  { name: 'home', path: '/', component: <Home /> },\n  { name: 'Zenless Zone Zero', path: '/game/zenless-zone-zero', component: <ZenlessZoneZero /> },\n  { name: 'ฐานข้อมูล Zenless Zone Zero', path: '/game/zenless-zone-zero/database', component: <DatabaseRoute /> },\n];\n`);
edit('zzz/src/routes/route.tsx', [["item.path === '/timeline' ? '/timeline/*' : item.path", 'item.path']]);
write('timeline/src/App.tsx', `import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';\nimport Timeline from './views/timeline';\n\nexport default function App() {\n  return <BrowserRouter><div className="timeline-shell"><Routes>\n    <Route path="/" element={<Navigate to="/timeline" replace />} />\n    <Route path="/timeline/*" element={<Timeline />} />\n    <Route path="*" element={<p>ไม่พบหน้านี้ <a href="/timeline">กลับ Timeline</a></p>} />\n  </Routes></div></BrowserRouter>;\n}\n`);
write('timeline/src/index.css', `:root { font-family: Inter, system-ui, sans-serif; line-height: 1.5; font-weight: 400; background: #000; color: #ebeee8; font-synthesis: none; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }\nbody { margin: 0; background: #000; }\na { text-decoration: none; }\n.timeline-shell { min-height: 100vh; box-sizing: border-box; padding: 32px; }\n@media (max-width: 600px) { .timeline-shell { padding: 8px; } }\n`);
function walk(dir, callback) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'lib', 'public', 'evidence', '.nanoka', '.timeline', 'dist'].includes(item.name)) continue;
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) walk(file, callback);
    else callback(file);
  }
}
walk('zzz', file => {
  if (!/\.(?:tsx?|mjs|css|json)$/.test(file)) return;
  edit(file, [['SayariNanokaDataCollector', 'ZZZNanokaDataCollector'], ['sayari-', 'zzz-'], ['sayari.locale', 'zzz.locale'], ['SAYARI_TEST_ORIGIN', 'ZZZ_TEST_ORIGIN'], ['SAYARI_PREVIEW_ORIGIN', 'ZZZ_PREVIEW_ORIGIN'], ['SAYARI', 'ZZZ'], ['http://127.0.0.1:5174', 'http://127.0.0.1:5173']]);
});
walk('timeline', file => {
  if (!/\.(?:tsx?|mjs|css|json)$/.test(file)) return;
  edit(file, [['demo-sayari-timeline', 'demo-timeline'], ['sayari-timeline-functions', 'timeline-functions'], ['SAYARI_TIMELINE_ORIGIN', 'TIMELINE_TEST_ORIGIN'], ['สร้างบัญชี Sayari', 'สร้างบัญชี Timeline'], ['Sayari Timeline', 'Timeline'], ['SAYARI / TIMELINE', 'TIMELINE'], ['SAYARI TIMELINE', 'TIMELINE'], ['<span className="tl-brand-mark">S</span>SAYARI <span>Timeline</span>', '<span className="tl-brand-mark">T</span><span>Timeline</span>']]);
});
edit('timeline/.env.emulator', [['demo-sayari-timeline', 'demo-timeline']]);
edit('timeline/tools/timeline/browser.mjs', [['../nanoka/tools/network-discovery/node_modules/playwright/index.mjs', 'playwright']]);
edit('timeline/tools/timeline/unit.test.ts', [['_handoff/SAYARI_TIMELINE_CODEX_V5_20261018/tests/vectors.v5.json', 'tests/fixtures/vectors.v5.json']]);
for (const file of ['browser.mjs', 'integration.mjs']) edit(`timeline/tools/timeline/${file}`, [['const require = createRequire(', 'await fs.mkdir("evidence/timeline", { recursive: true });\nconst require = createRequire(']]);
const fb = json('timeline/firebase.json');
fb.functions[0].predeploy = ['npm --prefix "$RESOURCE_DIR" run build'];
fb.hosting.rewrites = [{ source: '/timeline{,/**}', destination: '/index.html' }];
fb.hosting.headers = [{ source: '/index.html', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }, { source: '/assets/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
save('timeline/firebase.json', fb);
let checks = read('timeline/tools/timeline/checks.mjs');
checks = checks.slice(0, checks.indexOf('        ["nanoka"')) + checks.slice(checks.indexOf('      ];', checks.indexOf('        ["nanoka"')));
checks = checks.replace('const resultPath =', 'fs.mkdirSync("evidence/timeline", { recursive: true });\nconst resultPath =');
write('timeline/tools/timeline/checks.mjs', checks);
let calc = read('zzz/tools/calculator/preservation.mjs');
calc = calc.replace('../nanoka/tools/network-discovery/node_modules/playwright/index.mjs', 'playwright');
calc = calc.slice(0, calc.indexOf('const baseline =')) + 'await fs.mkdir("evidence/calculator", { recursive: true });\n' + calc.slice(calc.indexOf('const browser ='));
calc = calc.replace('import { createHash } from "node:crypto";\n', '').replaceAll('evidence/timeline/', 'evidence/calculator/').replace('evidence/calculator/calculator-baseline.json', 'tests/fixtures/calculator-baseline.json');
calc = calc.replace('    sourceFilesVerified: Object.keys(baseline.hashes).length - allowed.length,\n    changed,\n', '');
write('zzz/tools/calculator/preservation.mjs', calc);
edit('zzz/tools/nanoka/scripts/verify-hosting.mjs', [["'Local Vite production preview, not a Firebase emulator or production deploy. Firebase rewrite/cache header rules were checked against official documentation but not executed on Firebase in this task.'", "'Local Vite production preview. Configure SPA routes and static JSON cache headers on your chosen static host.'"], ["'A missing JSON request may receive the Vite SPA HTML fallback in preview. The application rejects non-JSON responses; Firebase config scopes rewrites to game routes so /nanoka is excluded.'", "'A missing JSON request may receive the Vite SPA HTML fallback in preview. The application rejects non-JSON responses.'"]]);
save('zzz/.nanoka/workflow.json', { evidenceDir: 'evidence/nanoka-zzz/project-split' });
console.log('Configured independent ZZZ and Timeline projects');
