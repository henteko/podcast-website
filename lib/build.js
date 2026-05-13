import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { resolveBin } from "./resolve.js";

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;
const CONFIG_JSON_TOKEN = "{{config.json}}";

export function build({ pkgRoot, cwd, minify = true }) {
  const config = readConfig(cwd);
  const render = makeRenderer(config);

  renderTo({
    src: resolveTemplate("index.html", { pkgRoot, cwd }),
    out: path.join(cwd, "dist/index.html"),
    render,
  });

  // CSS is written into the package's own directory so that Tailwind can
  // resolve `@import "tailwindcss"` via its own node_modules — works regardless
  // of whether transitive deps get hoisted in the user project.
  renderCss({
    src: resolveTemplate("input.css", { pkgRoot, cwd }),
    out: path.join(pkgRoot, ".tmp/input.css"),
    render,
    pkgRoot,
    cwd,
  });

  renderTo({
    src: resolveTemplate("functions/episode/[guid].js", { pkgRoot, cwd }),
    out: path.join(cwd, "functions/episode/[guid].js"),
    render,
  });

  copyTo({
    src: resolveTemplate("_redirects", { pkgRoot, cwd }),
    out: path.join(cwd, "dist/_redirects"),
  });

  copyStatic({ pkgRoot, cwd });

  runTailwind({ pkgRoot, cwd, minify });
}

function readConfig(cwd) {
  const p = path.join(cwd, "podcast.config.json");
  if (!fs.existsSync(p)) {
    throw new Error(
      `podcast.config.json not found in ${cwd}. Run \`podcast-website init\` first.`
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function makeRenderer(config) {
  return (tpl) =>
    tpl
      .split(CONFIG_JSON_TOKEN)
      .join(JSON.stringify(config))
      .replace(TOKEN_RE, (match, key) => {
        const v = key
          .split(".")
          .reduce((acc, k) => (acc == null ? acc : acc[k]), config);
        if (v == null) {
          console.warn(`[podcast-website] unresolved placeholder: ${match}`);
          return "";
        }
        return String(v);
      });
}

function resolveTemplate(relPath, { pkgRoot, cwd }) {
  const userPath = path.join(cwd, "src", relPath);
  if (fs.existsSync(userPath)) return userPath;
  return path.join(pkgRoot, "templates/src", relPath);
}

function renderTo({ src, out, render }) {
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, render(fs.readFileSync(src, "utf8")));
}

function renderCss({ src, out, render, pkgRoot, cwd }) {
  let css = render(fs.readFileSync(src, "utf8"));

  // Tailwind v4 auto-detects sources by walking up from the input CSS, but our
  // input lives in <pkg>/.tmp/ — far from where the rendered HTML and user
  // overrides live. Inject explicit @source directives so utility classes get
  // emitted regardless of project layout.
  const sources = [];
  // Package templates: use a relative path so the generated CSS doesn't bake
  // the absolute path of this machine into the file.
  sources.push("../templates/src");
  // User overrides live outside the package tree, so we can't use a stable
  // relative path — fall back to absolute.
  const userSrc = path.join(cwd, "src");
  if (fs.existsSync(userSrc)) sources.push(userSrc);

  const directives = sources.map((p) => `@source "${p}";`).join("\n");
  css = css.replace(/(@import\s+"tailwindcss";)/, `$1\n${directives}`);

  ensureDir(path.dirname(out));
  fs.writeFileSync(out, css);
}

function copyTo({ src, out }) {
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(out));
  fs.copyFileSync(src, out);
}

function copyStatic({ pkgRoot, cwd }) {
  const distDir = path.join(cwd, "dist");
  ensureDir(distDir);

  const userStatic = path.join(cwd, "src/static");
  if (fs.existsSync(userStatic)) copyDirFiles(userStatic, distDir);

  const pkgStatic = path.join(pkgRoot, "templates/src/static");
  if (fs.existsSync(pkgStatic)) copyDirFiles(pkgStatic, distDir, { skipExisting: true });
}

function copyDirFiles(srcDir, outDir, { skipExisting = false } = {}) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const out = path.join(outDir, entry.name);
    if (skipExisting && fs.existsSync(out)) continue;
    fs.copyFileSync(path.join(srcDir, entry.name), out);
  }
}

function runTailwind({ pkgRoot, cwd, minify }) {
  const script = resolveBin("@tailwindcss/cli", "tailwindcss");
  const input = path.join(pkgRoot, ".tmp/input.css");
  const output = path.join(cwd, "dist/style.css");
  const args = [script, "-i", input, "-o", output];
  if (minify) args.push("--minify");
  const r = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) throw new Error("Tailwind build failed");
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}
