import fs from "node:fs";
import path from "node:path";

export function init(targetDir, { pkgRoot, pkgVersion, pkgName }) {
  const dest = path.resolve(targetDir);
  fs.mkdirSync(dest, { recursive: true });

  const created = [];
  const skipped = [];

  // 1. Simple copies
  for (const [srcRel, destRel] of [
    ["templates/podcast.config.json", "podcast.config.json"],
    ["templates/wrangler.jsonc", "wrangler.jsonc"],
    ["templates/_gitignore", ".gitignore"],
  ]) {
    const src = path.join(pkgRoot, srcRel);
    const out = path.join(dest, destRel);
    if (fs.existsSync(out)) {
      skipped.push(destRel);
      continue;
    }
    fs.copyFileSync(src, out);
    created.push(destRel);
  }

  // 2. Scaffolded package.json with dynamic name + dep version
  const userPkgPath = path.join(dest, "package.json");
  if (fs.existsSync(userPkgPath)) {
    skipped.push("package.json");
  } else {
    const tplPath = path.join(pkgRoot, "templates/package.json");
    const tpl = JSON.parse(fs.readFileSync(tplPath, "utf8"));
    tpl.name = path.basename(dest).toLowerCase().replace(/[^a-z0-9-]/g, "-") || "my-podcast-website";
    tpl.devDependencies = tpl.devDependencies || {};
    tpl.devDependencies[pkgName] = `^${pkgVersion}`;
    fs.writeFileSync(userPkgPath, JSON.stringify(tpl, null, 2) + "\n");
    created.push("package.json");
  }

  for (const f of created) console.log(`[init] created: ${f}`);
  for (const f of skipped) console.log(`[init] skip (exists): ${f}`);

  const rel = path.relative(process.cwd(), dest) || ".";
  console.log("");
  console.log("Done. Next steps:");
  if (rel !== ".") console.log(`  cd ${rel}`);
  console.log("  npm install");
  console.log("  # edit podcast.config.json");
  console.log("  npm run dev      # local preview");
  console.log("  npm run deploy   # deploy to Cloudflare Pages");
}
