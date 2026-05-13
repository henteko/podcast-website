import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function resolveBin(packageName, binName = packageName) {
  const pkgJsonPath = require.resolve(`${packageName}/package.json`);
  const pkgDir = path.dirname(pkgJsonPath);
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

  let binEntry;
  if (typeof pkgJson.bin === "string") {
    binEntry = pkgJson.bin;
  } else if (pkgJson.bin && typeof pkgJson.bin === "object") {
    binEntry = pkgJson.bin[binName];
  }
  if (!binEntry) {
    throw new Error(`Cannot find bin "${binName}" in package ${packageName}`);
  }
  return path.join(pkgDir, binEntry);
}
