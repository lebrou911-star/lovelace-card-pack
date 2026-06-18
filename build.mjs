// Build script for lovelace-card-pack.
//
// Bundles every card under src/ (via the side-effect imports in src/index.js)
// into a single IIFE file that HACS serves as a Lovelace resource:
//   dist/lovelace-card-pack.js
//
// The pack version is read from package.json and injected as the global
// constant __PACK_VERSION__ so the bundle can log a banner without importing
// package.json at runtime.
//
// Usage:
//   node build.mjs           # one-shot build
//   node build.mjs --watch   # rebuild on change

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import esbuild from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8"));

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [resolve(here, "src/index.js")],
  outfile: resolve(here, "dist/lovelace-card-pack.js"),
  bundle: true,
  format: "iife",
  target: "es2019",
  legalComments: "inline",
  charset: "utf8",
  banner: {
    js: `/*! lovelace-card-pack v${pkg.version} | https://github.com/lebrou911-star/lovelace-card-pack */`,
  },
  define: {
    __PACK_VERSION__: JSON.stringify(pkg.version),
  },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log(`[lovelace-card-pack] watching… (v${pkg.version})`);
} else {
  await esbuild.build(options);
  console.log(`[lovelace-card-pack] built dist/lovelace-card-pack.js (v${pkg.version})`);
}
