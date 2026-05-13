#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { build } from "../lib/build.js";
import { init } from "../lib/init.js";
import { fetchAssets } from "../lib/assets.js";
import { resolveBin } from "../lib/resolve.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"));

const [, , cmd, ...rest] = process.argv;

function help() {
  console.log(`podcast-website v${pkg.version}

Usage:
  podcast-website <command>

Commands:
  init [dir]      Scaffold a new podcast website project (default: current dir)
  assets [url]    Download cover art and generate OGP + favicons in src/static/
                  (if url omitted, fetches show.imageUrl from api.url)
  build           Render templates and compile CSS into ./dist + ./functions
  dev             Build, watch CSS, and start local Cloudflare Pages dev server
  deploy          Build and deploy to Cloudflare Pages
  help            Show this help

Examples:
  npx podcast-website init my-podcast
  cd my-podcast && npm install
  npx podcast-website assets        # generate cover-derived images
  npm run dev
`);
}

async function main() {
  try {
    switch (cmd) {
      case "init":
        init(rest[0] || ".", {
          pkgRoot,
          pkgVersion: pkg.version,
          pkgName: pkg.name,
        });
        return;
      case "assets":
        await fetchAssets({ cwd: process.cwd(), urlOverride: rest[0] });
        return;
      case "build":
        build({ pkgRoot, cwd: process.cwd() });
        return;
      case "dev":
        runDev();
        return;
      case "deploy":
        build({ pkgRoot, cwd: process.cwd() });
        await runNode(resolveBin("wrangler"), ["pages", "deploy", "dist"]);
        return;
      case undefined:
      case "help":
      case "--help":
      case "-h":
        help();
        return;
      default:
        console.error(`Unknown command: ${cmd}\n`);
        help();
        process.exit(1);
    }
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

function runDev() {
  const cwd = process.cwd();
  build({ pkgRoot, cwd, minify: false });

  const tailwindScript = resolveBin("@tailwindcss/cli", "tailwindcss");
  const wranglerScript = resolveBin("wrangler");
  const cssInput = path.join(pkgRoot, ".tmp/input.css");
  const cssOutput = path.join(cwd, "dist/style.css");

  const tw = spawn(
    process.execPath,
    [tailwindScript, "-i", cssInput, "-o", cssOutput, "--watch"],
    { stdio: "inherit" }
  );
  const wr = spawn(process.execPath, [wranglerScript, "pages", "dev", "dist"], {
    cwd,
    stdio: "inherit",
  });

  const shutdown = () => {
    tw.kill();
    wr.kill();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  wr.on("exit", (code) => {
    tw.kill();
    process.exit(code ?? 0);
  });
}

function runNode(script, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [script, ...args], { stdio: "inherit" });
    proc.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`process exited with ${code}`))
    );
  });
}

main();
