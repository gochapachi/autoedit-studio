// Renders one card to a transparent WebM. Invoked by the AutoEdit engine:
//   node render.mjs <compositionId> <output.webm> <jsonInputProps>
// Emits {"progress": 0-100} JSON lines on stdout for live progress.
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const [,, compositionId, outputLocation, propsJson] = process.argv;
if (!compositionId || !outputLocation) {
  console.error("usage: node render.mjs <compositionId> <output.webm> <propsJson>");
  process.exit(1);
}
const inputProps = propsJson ? JSON.parse(propsJson) : {};

const { bundle } = await import("@remotion/bundler");
const { selectComposition, renderMedia } = await import("@remotion/renderer");

// Cache the bundle so repeat renders start fast
const bundleCacheDir = path.resolve(".bundle-cache");
const cacheMarker = path.join(bundleCacheDir, ".done");
let serveUrl;
if (fs.existsSync(cacheMarker)) {
  serveUrl = pathToFileURL(path.join(bundleCacheDir, "index.html")).href;
} else {
  const bundleDir = await bundle({
    entryPoint: path.resolve("./src/register.ts"),
    onProgress: (p) => {
      process.stdout.write(JSON.stringify({ bundling: Math.round(p * 100) }) + "\n");
    },
  });
  fs.rmSync(bundleCacheDir, { recursive: true, force: true });
  fs.cpSync(bundleDir, bundleCacheDir, { recursive: true });
  fs.writeFileSync(cacheMarker, "ok");
  serveUrl = pathToFileURL(path.join(bundleCacheDir, "index.html")).href;
}

const composition = await selectComposition({
  serveUrl,
  id: compositionId,
  inputProps,
});

await renderMedia({
  composition,
  serveUrl,
  codec: "vp8",
  pixelFormat: "yuva420p", // alpha channel for compositing over video
  outputLocation,
  inputProps,
  onProgress: ({ progress }) => {
    process.stdout.write(JSON.stringify({ progress: Math.round(progress * 100) }) + "\n");
  },
});

if (!fs.existsSync(outputLocation)) {
  console.error("render finished but output missing: " + outputLocation);
  process.exit(1);
}
process.stdout.write(JSON.stringify({ done: true, outputLocation }) + "\n");
