import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const candidates = [
  process.env.npm_execpath,
  path.join(process.env.APPDATA || "", "npm/node_modules/npm/bin/npm-cli.js"),
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
].filter(Boolean);
const npm = candidates.find((p) => fs.existsSync(p));
if (!npm) throw Error("npm CLI not found");
const commands = process.argv.includes("--emulator-build")
  ? [["emulator-build", "npm run timeline:build", [npm, "run", "timeline:build"]]]
  : process.argv.includes("--restriction")
  ? [["restriction", "node tools/timeline/integration.mjs --restriction", ["tools/timeline/integration.mjs", "--restriction"]]]
  : process.argv.includes("--browser")
  ? [
      [
        "browser",
        "node tools/timeline/browser.mjs",
        ["tools/timeline/browser.mjs"],
      ],
    ]
  : process.argv.includes("--integration")
    ? [
        [
          "integration",
          "node tools/timeline/integration.mjs",
          ["tools/timeline/integration.mjs"],
        ],
      ]
    : [
        ["build", "npm run build", [npm, "run", "build"]],
        ["lint", "npm run lint", [npm, "run", "lint"]],
        ["unit", "npm run timeline:unit", [npm, "run", "timeline:unit"]],
      ];
fs.mkdirSync("evidence/timeline", { recursive: true });
const resultPath = "evidence/timeline/commands.json";
const records = fs.existsSync(resultPath)
  ? JSON.parse(fs.readFileSync(resultPath, "utf8"))
  : [];
for (const [name, command, args] of commands) {
  const start = new Date().toISOString();
  const chunks = [];
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: "1" },
    });
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("exit", resolve);
    child.on("error", (e) => {
      chunks.push(Buffer.from(e.stack));
      resolve(1);
    });
  });
  const log = `evidence/timeline/${name}.log`;
  fs.writeFileSync(log, Buffer.concat(chunks));
  records.push({
    command,
    exitCode: code,
    startedAt: start,
    finishedAt: new Date().toISOString(),
    log,
  });
  fs.writeFileSync(resultPath, JSON.stringify(records, null, 2));
  console.log(
    `${code === 0 ? "PASS" : "FAIL"} ${command} — exit ${code}; ${log}`,
  );
  if (code !== 0) {
    console.log(Buffer.concat(chunks).toString("utf8").slice(-7000));
    process.exitCode = 1;
  }
}
