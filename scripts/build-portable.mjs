/**
 * Builds a portable Windows release:
 *   release/Fantasy Build.exe  (+ release/web/ if not embedded)
 *
 * Run on YOUR PC (needs Node once): npm run build:portable
 * Copy release/ folder or just the .exe + web to USB.
 */
import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const DIST = join(ROOT, "dist");
const RELEASE = join(ROOT, "release");
const WEB = join(DIST, "web");

function run(cmd) {
  console.log(`\n> ${cmd}\n`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}

console.log("=== Fantasy Build — portable release ===\n");

rmSync(DIST, { recursive: true, force: true });
rmSync(RELEASE, { recursive: true, force: true });
mkdirSync(RELEASE, { recursive: true });

console.log("1/3  Static export (next build)...");
run("npm run build");

if (!existsSync(OUT)) {
  console.error("Build failed: out/ folder missing.");
  process.exit(1);
}

console.log("2/3  Copying game files...");
mkdirSync(WEB, { recursive: true });
cpSync(OUT, WEB, { recursive: true });

console.log("3/3  Packaging launcher .exe...");
try {
  run(
    `npx --yes @yao-pkg/pkg@6.2.0 scripts/launcher.cjs --targets node20-win-x64 --output "${join(DIST, "Fantasy-Build")}" --compress GZip`
  );
} catch {
  console.warn("\n  pkg packaging failed — falling back to node launcher only.\n");
}

mkdirSync(RELEASE, { recursive: true });

const exeCandidates = [
  join(DIST, "Fantasy-Build.exe"),
  join(DIST, "launcher.exe"),
];

let exeSrc = exeCandidates.find((p) => existsSync(p));
const exeDest = join(RELEASE, "Fantasy Build.exe");

if (exeSrc) {
  cpSync(exeSrc, exeDest);
  console.log(`\n  Created: ${exeDest}`);
} else {
  console.log("\n  .exe not created — copy Play Fantasy Build.bat for dev use.");
}

// Always ship web beside exe (works with or without pkg asset embedding)
const releaseWeb = join(RELEASE, "web");
cpSync(WEB, releaseWeb, { recursive: true });

// Tiny fallback launcher if pkg failed
const bat = `@echo off
cd /d "%~dp0"
if exist "Fantasy Build.exe" (
  start "" "Fantasy Build.exe"
  exit /b 0
)
echo Run "npm run build:portable" on a dev machine first.
pause
`;
import { writeFileSync } from "fs";
writeFileSync(join(RELEASE, "Play Fantasy Build.bat"), bat, "utf8");

console.log(`
=== Done ===

  Folder: ${RELEASE}
  - Fantasy Build.exe   (double-click on any Windows PC — no Node install)
  - web/                (game files — keep next to the .exe)
  - Play Fantasy Build.bat

  USB: copy the whole "release" folder, or zip it as one archive.

  Rebuild after game changes: npm run build:portable
`);
