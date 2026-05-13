import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function fetchAssets({ cwd, urlOverride }) {
  const sharp = loadSharp();

  let url = urlOverride;
  let source = urlOverride ? "(--url)" : "podcast.config.json api.url";

  if (!url) {
    const configPath = path.join(cwd, "podcast.config.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(
        `podcast.config.json not found in ${cwd}. Run \`podcast-website init\` first, or pass an image URL explicitly.`
      );
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const apiUrl = config.api?.url;
    if (!apiUrl) throw new Error("api.url not set in podcast.config.json");

    console.log(`[assets] fetching show metadata: ${apiUrl}`);
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) throw new Error(`API returned ${apiRes.status}`);
    const data = await apiRes.json();
    url = data.show?.imageUrl;
    if (!url) throw new Error("show.imageUrl not found in API response");
  }

  console.log(`[assets] downloading cover image: ${url}`);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`image fetch returned ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());

  const staticDir = path.join(cwd, "src/static");
  fs.mkdirSync(staticDir, { recursive: true });

  const ext = pickExtension(imgRes.headers.get("content-type"), url);
  const originalPath = path.join(staticDir, `cover.${ext}`);
  fs.writeFileSync(originalPath, buf);
  console.log(`[assets]   saved: src/static/cover.${ext}  (original, source: ${source})`);

  // OGP image: 1200x1200 square PNG. Most social cards crop/letterbox a square
  // image fine, and podcast cover art is always square anyway.
  await sharp(buf)
    .resize(1200, 1200, { fit: "cover" })
    .png()
    .toFile(path.join(staticDir, "ogp.png"));
  console.log("[assets]   generated: src/static/ogp.png         (1200x1200)");

  // apple-touch-icon (also referenced from site.favicon in config)
  await sharp(buf)
    .resize(180, 180)
    .png()
    .toFile(path.join(staticDir, "favicon.png"));
  console.log("[assets]   generated: src/static/favicon.png     (180x180, apple-touch-icon)");

  // Browser tab favicon
  await sharp(buf)
    .resize(32, 32)
    .png()
    .toFile(path.join(staticDir, "favicon-32.png"));
  console.log("[assets]   generated: src/static/favicon-32.png  (32x32, browser tab)");

  console.log("");
  console.log("Done. Next steps:");
  console.log("  - site.favicon / site.favicon32 in podcast.config.json already point to");
  console.log("    /favicon.png and /favicon-32.png — no edit needed.");
  console.log("  - For OGP, update site.ogImage to an absolute URL, e.g.:");
  console.log('      "ogImage": "https://your-site.example.com/ogp.png"');
  console.log("    (OGP requires absolute URLs; social crawlers will not resolve relative paths.)");
  console.log("  - Run `podcast-website build` to copy src/static/* into dist/.");
}

function loadSharp() {
  try {
    return require("sharp");
  } catch (err) {
    throw new Error(
      "sharp module not found. It should be installed as a dependency of @henteko/podcast-website — try `npm install` again."
    );
  }
}

function pickExtension(contentType, url) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  try {
    const ext = path.extname(new URL(url).pathname).slice(1).toLowerCase();
    if (ext) return ext;
  } catch {}
  return "jpg";
}
