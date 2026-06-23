import { build, context } from "esbuild";
import { readFileSync } from "fs";

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ["es2018", "chrome63", "firefox58", "safari11.1", "edge79"],
  format: "iife",
  globalName: "InsightsWidgetGlobal",
  outfile: "dist/insights-widget.js",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  treeShaking: true,
};

import { copyFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[insights-widget] Watching for changes…");
} else {
  const result = await build({ ...options, metafile: true });
  const size = Object.values(result.metafile.outputs)[0].bytes;
  console.log(`[insights-widget] Built — ${(size / 1024).toFixed(1)} KB`);

  // Auto-copy to NextJS public folder for local testing
  const targetPath = "../../apps/web/public/insights-widget.js";
  try {
    if (!existsSync(dirname(targetPath))) {
      mkdirSync(dirname(targetPath), { recursive: true });
    }
    copyFileSync("dist/insights-widget.js", targetPath);
    console.log(`[insights-widget] Copied to apps/web/public/`);
  } catch (err) {
    console.error("[insights-widget] Failed to copy to apps/web/public/:", err.message);
  }
}
