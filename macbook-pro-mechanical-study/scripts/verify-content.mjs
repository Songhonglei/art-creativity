/**
 * verify-content.mjs — visual self-check for a content-creation deliverable.
 *
 * PROCESS ARTIFACT. Everything it writes lands in verification-shots/ — review the
 * images, fix the worst defect, re-run, and **delete verification-shots/ before you
 * deliver**. The deliverable must not ship with the probe output inside it.
 *
 * Usage
 *   node scripts/verify-content.mjs                       # serve dist/ if present, else the project
 *   node scripts/verify-content.mjs --loop 12             # force the t=0 / t=12 loop seam check
 *   node scripts/verify-content.mjs --no-loop             # static piece: skip the seam check
 *   node scripts/verify-content.mjs --dir . --page index.html --budget 12000
 *
 * --out must name a sub-directory of the project (default verification-shots/). It is
 * emptied on every run, so `--out .` is refused rather than obeyed.
 *
 * Why it is written this way:
 *   - Pure node, zero npm dependencies: the --html and --svg skeletons have no
 *     package.json at all, so playwright is not an option. Screenshots go through
 *     the system browser's command line instead.
 *   - Headless Chrome is *told* to render WebGL in software (SwiftShader) — it no
 *     longer falls back on its own, see BASE_FLAGS. That proves the scene renders
 *     and the logic is right; it proves nothing about frame rate.
 *   - Cropping and pixel comparison run through /usr/local/bin/3dpy + PIL
 *     (preinstalled in the sandbox). The launcher, bpy and required PIL imports
 *     are verified first; runtime or measurement errors fail the check.
 *
 * What it checks
 *   1. the page serves, renders, and is not a blank/uniform canvas
 *   2. zero page errors, zero 404s (an error collector is injected into the served
 *      HTML in memory — your files are never modified)
 *   3. window.__seek / window.__SCENE_READY__ are exposed
 *   4. looped animation is pixel-identical at t=0 and t=T — T comes from --loop, or
 *      is read out of the source (a DURATION constant) when --loop is not given
 *   5. full view + thumbnail + structure crop + repeated-detail crop, to open and look at
 *   6. source self-check: unseeded Math.random(), TODO/FIXME, leftover throws, external URLs
 */

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const USAGE = "usage: node scripts/verify-content.mjs [--dir <project>] [--page index.html] "
  + "[--loop <seconds>] [--no-loop] [--budget <ms>] [--out <sub-dir>]";

function die(message) {
  console.error(`VERIFY FAIL: ${message}`);
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv) {
  // budget is Chrome's --virtual-time-budget, and virtual time only advances while the
  // renderer is idle — so it is not a wall-clock deadline and software GL does not eat
  // into it. Measured on the --three skeleton under SwiftShader: the 1440x900 frame is
  // already pixel-identical to a 40000ms run at a budget of 2000, and every shot costs
  // ~1.6s of wall clock either way. 9000 is roughly 4x more than the skeleton needs;
  // raise it with --budget for a piece that genuinely settles late (long intro tween,
  // texture decode), not because rendering is in software.
  const out = { dir: process.cwd(), page: "index.html", loop: null, noLoop: false, budget: 9000, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // a flag that takes a value must actually be followed by one — `--dir` on its own
    // used to reach path.resolve(undefined) and die with a raw ERR_INVALID_ARG_TYPE
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) die(`${a} needs a value — nothing followed it.`);
      if (value.startsWith("--")) die(`${a} needs a value, but the next argument is "${value}".`);
      i += 1;
      return value;
    };
    const positive = (raw, what) => {
      const value = Number(raw);
      if (!Number.isFinite(value)) die(`${a} needs ${what}, got "${raw}".`);
      if (value <= 0) die(`${a} must be greater than 0, got ${value}.`);
      return value;
    };
    if (a === "--dir") out.dir = next();
    else if (a === "--page") out.page = next();
    // --loop 0 used to slip past the `=== null || isNaN` guard and compare t=0 with t=0
    else if (a === "--loop") out.loop = positive(next(), "a loop length in seconds (use --no-loop to skip the check)");
    else if (a === "--no-loop") out.noLoop = true;
    else if (a === "--budget") out.budget = positive(next(), "a virtual-time budget in milliseconds");
    else if (a === "--out") out.out = next();
    else if (a === "-h" || a === "--help") {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      console.error(USAGE);
      process.exit(2);
    }
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const PROJECT = resolve(ARGS.dir);
const SERVE_ROOT = existsSync(join(PROJECT, "dist", "index.html")) ? join(PROJECT, "dist") : PROJECT;

/**
 * Resolve --out.
 *
 * This directory is emptied before every run, so an unchecked value is a
 * project-deleting footgun: `--out .` resolves to the project itself and
 * `--out ..` to its parent. A relative path is therefore pinned under the
 * project, and the result must be a strict sub-directory of it that neither
 * is nor contains the directory being served.
 */
const contains = (parent, child) => child === parent || child.startsWith(parent + sep);

function resolveShots(raw) {
  const candidate = resolve(PROJECT, raw ?? "verification-shots");
  const shown = raw === null || raw === undefined ? "verification-shots" : raw;
  if (candidate === PROJECT) {
    die(`--out ${shown} points at the project itself (${PROJECT}).\n`
      + "  the --out directory is emptied on every run — pass a sub-directory, e.g. --out verification-shots.");
  }
  if (!contains(PROJECT, candidate)) {
    die(`--out ${shown} resolves to ${candidate}, which is outside the project (${PROJECT}).\n`
      + "  the --out directory is emptied on every run — it must be a sub-directory of the project.");
  }
  if (contains(candidate, SERVE_ROOT)) {
    die(`--out ${shown} resolves to ${candidate}, which is (or contains) the directory being served (${SERVE_ROOT}).\n`
      + "  the --out directory is emptied on every run — pick one that holds no deliverable, e.g. --out verification-shots.");
  }
  return candidate;
}

const SHOTS = resolveShots(ARGS.out);

// ---------------------------------------------------------------------------
// Report ledger
// ---------------------------------------------------------------------------
const report = [];
const add = (level, label, detail = "") => report.push({ level, label, detail });
const ok = (label, detail) => add("ok", label, detail);
const warn = (label, detail) => add("warn", label, detail);
const bad = (label, detail) => add("fail", label, detail);

function finish(server) {
  try { server?.close(); } catch { /* already closed */ }
  const failures = report.filter((r) => r.level === "fail");
  const warnings = report.filter((r) => r.level === "warn");
  console.log("");
  console.log("==== verify-content: what was looked at ====");
  for (const r of report) {
    const mark = r.level === "ok" ? "PASS" : r.level === "warn" ? "WARN" : "FAIL";
    console.log(`  [${mark}] ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log("");
  console.log(`shots: ${SHOTS}`);
  console.log("OPEN THE IMAGES AND LOOK — overexposure, a subject too small, a missing contact");
  console.log("shadow and a broken silhouette are invisible to this script and to exit codes.");
  console.log("Then delete verification-shots/ before delivery (it is a process artifact).");
  console.log(`==== ${failures.length} fail · ${warnings.length} warn · ${report.length - failures.length - warnings.length} pass ====`);
  process.exit(failures.length ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Browser discovery
// ---------------------------------------------------------------------------
const browserLookupErrors = [];

function findBrowser() {
  const candidates = [
    process.env.CHROME,
    process.env.CHROMIUM,
    "chromium",
    "chromium-browser",
    "google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes(sep)) {
      if (existsSync(candidate)) return candidate;
      browserLookupErrors.push(`${candidate}: file does not exist`);
      continue;
    }
    const command = `command -v ${candidate}`;
    const which = spawnSync("sh", ["-c", command], { encoding: "utf8" });
    if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
    browserLookupErrors.push(`sh -c ${JSON.stringify(command)}: ${which.error?.message || which.stderr?.trim() || `exit ${which.status}`}`);
  }
  return null;
}

const BROWSER = findBrowser();
if (!BROWSER) {
  console.error("VERIFY FAIL: no chromium/chrome binary found.");
  console.error("  looked at: $CHROME, $CHROMIUM, chromium, chromium-browser, google-chrome,");
  console.error("             /Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
  for (const error of browserLookupErrors) console.error(`    ${error}`);
  console.error("  repair the preinstalled browser environment, or point at an existing binary:");
  console.error("    export CHROME=/path/to/chrome");
  console.error("  do not install dependencies at runtime.");
  console.error("  getting a working browser is part of the job — do not fall back to reading the code.");
  process.exit(1);
}

const PROFILE = join(tmpdir(), `verify-content-${process.pid}`);

/**
 * Chrome flags. The three GL flags below are load-bearing — DO NOT "tidy" them away.
 *
 * --disable-gpu stays: a verifier must behave the same on a laptop with a GPU and in
 * a headless container with neither GPU nor display server. Letting Chrome reach for
 * real hardware makes the run machine-dependent and, where there is no display
 * server, is the classic way to get a hung or crashing GPU process. Software GL is
 * slower but identical everywhere, which is what the pixel diffs in this script need.
 *
 * But since Chrome 119, --disable-gpu alone means NO WebGL AT ALL: Chrome removed the
 * automatic fallback to SwiftShader, so a page calling getContext('webgl') just gets
 * null. Every --three deliverable then fails this script with
 * "THREE.WebGLRenderer: A WebGL context could not be created", a blank 1440x900 frame
 * and a missing window.__seek — a self-check that no correct project can pass.
 * Software rendering therefore has to be asked for explicitly:
 *
 *   --enable-unsafe-swiftshader  re-enables the automatic software fallback that 119
 *                                removed. This is the flag Chrome's own error message
 *                                names, and it is what rescues us if the ANGLE backend
 *                                below is unavailable or spelled differently.
 *   --use-angle=swiftshader      pins ANGLE's backend to SwiftShader outright, instead
 *                                of relying on the fallback path at all. This is the
 *                                one that keeps working if Chrome ever drops the
 *                                "unsafe" opt-in, which it has always billed as
 *                                temporary.
 *
 * They are belt and braces, not duplicates: one re-enables a fallback, the other
 * skips the need for a fallback. Either alone fixes today's Chrome (measured on 153);
 * order between them makes no difference. Keeping both is what makes this survive a
 * Chrome that changes its mind about one of them.
 */
const BASE_FLAGS = [
  "--headless=new",
  "--disable-gpu",
  "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader",
  "--hide-scrollbars",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  "--force-device-scale-factor=1",
  "--run-all-compositor-stages-before-draw",
  `--user-data-dir=${PROFILE}`,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = join(tmpdir(), `verify-content-${process.pid}.log`);

/**
 * Run headless chrome until its artifact appears, then kill it.
 *
 * Some chrome builds (macOS ships one) write the --screenshot / --dump-dom output
 * and then never exit, so a plain spawnSync would block until the timeout on every
 * single shot. Waiting for the artifact instead is fast everywhere and still exits
 * immediately on builds that do quit on their own.
 *
 * timeoutMs is wall clock, and this is where software GL actually costs something: a
 * shot of the --three skeleton under SwiftShader measured ~1.6s, so 60s leaves plenty
 * of room, but a heavy scene (big shadow maps, post-processing) spends it far faster
 * than it would on a GPU. A scene that blows past it loses the screenshot and is
 * reported as "chrome wrote nothing" rather than as a timeout.
 */
async function chrome(extra, { artifact = null, marker = null, timeoutMs = 60000 } = {}) {
  const fd = openSync(LOG, "w");
  const child = spawn(BROWSER, [...BASE_FLAGS, ...extra], { stdio: ["ignore", fd, fd] });
  let exited = false;
  child.on("exit", () => { exited = true; });
  child.on("error", () => { exited = true; });

  const deadline = Date.now() + timeoutMs;
  let lastSize = -1, stable = 0, found = null;
  while (Date.now() < deadline) {
    await sleep(120);
    if (artifact) {
      try {
        const size = statSync(artifact).size;
        if (size > 0 && size === lastSize) { if (++stable >= 2) break; }
        else { stable = 0; lastSize = size; }
      } catch { /* not written yet */ }
    }
    if (marker) {
      try {
        const hit = readFileSync(LOG, "utf8").match(marker);
        if (hit) { found = hit; break; }
      } catch { /* nothing logged yet */ }
    }
    if (exited) break;
  }
  try { child.kill("SIGKILL"); } catch { /* already gone */ }
  closeSync(fd);
  let log = "";
  try { log = readFileSync(LOG, "utf8"); } catch { /* no log */ }
  if (!found && marker) found = log.match(marker);
  return { found, log, exited };
}

async function screenshot(url, file, width, height) {
  const target = join(SHOTS, file);
  const res = await chrome(
    [`--screenshot=${target}`, `--window-size=${width},${height}`, `--virtual-time-budget=${ARGS.budget}`, url],
    { artifact: target });
  if (!existsSync(target)) {
    bad(`screenshot ${file}`, `chrome wrote nothing — ${res.log.split("\n").filter(Boolean).pop() ?? "no output"}`);
    return null;
  }
  return target;
}

// ---------------------------------------------------------------------------
// Preinstalled 3D Python + PIL helpers (crops, pixel statistics, pixel diff)
// ---------------------------------------------------------------------------
const PYTHON = "/usr/local/bin/3dpy";
const PY = `
import sys, json
from PIL import Image, ImageChops, ImageStat
cmd = json.loads(sys.argv[1])
op = cmd["op"]
if op == "stats":
    im = Image.open(cmd["src"]).convert("RGB")
    st = ImageStat.Stat(im)
    print(json.dumps({"w": im.width, "h": im.height,
                      "mean": [round(v, 2) for v in st.mean],
                      "stddev": [round(v, 2) for v in st.stddev]}))
elif op == "crop":
    im = Image.open(cmd["src"]).convert("RGB")
    x0, y0, x1, y1 = [int(round(v)) for v in cmd["box"]]
    crop = im.crop((x0, y0, x1, y1))
    zoom = cmd.get("zoom", 1)
    if zoom != 1:
        crop = crop.resize((crop.width * zoom, crop.height * zoom), Image.LANCZOS)
    crop.save(cmd["dst"])
    print(json.dumps({"w": crop.width, "h": crop.height}))
elif op == "diff":
    a = Image.open(cmd["a"]).convert("RGB")
    b = Image.open(cmd["b"]).convert("RGB")
    if a.size != b.size:
        print(json.dumps({"error": "size mismatch %sx%s vs %sx%s" % (a.width, a.height, b.width, b.height)}))
    else:
        d = ImageChops.difference(a, b)
        # Keep the strongest RGB-channel difference at each pixel. A luminance
        # conversion can round a real one-level colour change down to zero.
        red, green, blue = d.split()
        delta = ImageChops.lighter(ImageChops.lighter(red, green), blue)
        bbox = delta.getbbox()
        px = a.width * a.height
        changed = px - delta.histogram()[0]
        print(json.dumps({"maxdiff": delta.getextrema()[1],
                          "changed_pct": round(100.0 * changed / px, 3),
                          "bbox": list(bbox) if bbox else None}))
else:
    print(json.dumps({"error": "unknown op"}))
`;

let PYTHON_OK = null;

function runPython(code, args = []) {
  const argv = ["-c", code, ...args];
  const res = spawnSync(PYTHON, argv, { encoding: "utf8", timeout: 120000 });
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  const command = [PYTHON, ...argv.map(quote)].join(" ");
  if (res.error || res.status !== 0) {
    const error = [res.error?.message, res.stderr?.trim(), res.stdout?.trim()]
      .filter(Boolean).join("\n") || `exit ${res.status}${res.signal ? ` (${res.signal})` : ""}`;
    bad("3D Python command failed", `command: ${command}\n${error}`);
    return null;
  }
  return { stdout: res.stdout, command };
}

function py(cmd) {
  if (PYTHON_OK === null) {
    PYTHON_OK = !!runPython("import sys, bpy; print(sys.executable); print(bpy.app.version_string)")
      && !!runPython("from PIL import Image, ImageChops, ImageStat");
  }
  if (PYTHON_OK === false) return null;
  const res = runPython(PY, [JSON.stringify(cmd)]);
  if (!res) return null;
  try {
    return JSON.parse(String(res.stdout).trim().split("\n").pop());
  } catch (error) {
    bad("3D Python result invalid", `command: ${res.command}\n${error.message}\n${res.stdout.trim()}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Static server (serves dist/ when it exists; injects an in-memory error collector)
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".wasm": "application/wasm", ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json", ".woff": "font/woff", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8",
};

const COLLECTOR = `<script>(function(){var E=window.__verifyErrors=[];
addEventListener('error',function(e){E.push(String((e&&(e.message||e.error))||(e.target&&e.target.src)||e))},true);
addEventListener('unhandledrejection',function(e){E.push('unhandledrejection: '+e.reason)});
var ce=console.error;console.error=function(){E.push(Array.prototype.map.call(arguments,String).join(' '));ce.apply(console,arguments)};})()</script>`;

const PROBE_PATH = "/__verify_probe";
const PROBE_HTML = `<!doctype html><meta charset="utf-8"><title>probe</title>
<style>html,body{margin:0}iframe{width:1280px;height:800px;border:0}</style>
<iframe id="f"></iframe><pre id="out">PENDING</pre>
<script>
var target = new URLSearchParams(location.search).get('target') || '/index.html';
var f = document.getElementById('f'), done = false;
function collect(){
  if (done) return; done = true;
  var r;
  try {
    var w = f.contentWindow, d = f.contentDocument;
    r = { ok:true, hasSeek: typeof w.__seek === 'function', sceneReady: !!w.__SCENE_READY__,
          title: d.title || '', canvases: d.querySelectorAll('canvas').length,
          svgs: d.querySelectorAll('svg').length, nodes: d.querySelectorAll('*').length,
          errors: (w.__verifyErrors || []).slice(0, 8) };
  } catch (e) { r = { ok:false, error:String(e) }; }
  document.getElementById('out').textContent = 'VERIFY_PROBE_JSON:' + encodeURIComponent(JSON.stringify(r));
}
f.addEventListener('load', function(){ setTimeout(collect, 1200); });
setTimeout(collect, 6000);
f.src = target;
</script>`;

const missing = [];

// The request listener runs synchronously: anything it throws is an
// uncaughtException that kills the whole verifier mid-run. One malformed
// resource URL in the page must not cost you every screenshot taken so far.
const server = createServer((req, res) => {
  try {
    serveRequest(req, res);
  } catch (error) {
    try { res.writeHead(400, { "content-type": "text/plain" }).end("400"); } catch { /* already answered */ }
  }
});

function serveRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, "http://127.0.0.1");
  } catch {
    res.writeHead(400, { "content-type": "text/plain" }).end("400 malformed request target");
    return;
  }
  if (url.pathname === PROBE_PATH) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PROBE_HTML);
    return;
  }
  let pathname;
  try {
    // `/%zz` and friends throw URIError here — decoding happens after the URL
    // parser has already normalised `..`, so `/..%2Fx` still escapes upward
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { "content-type": "text/plain" }).end("400 malformed percent-escape");
    return;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const file = resolve(join(SERVE_ROOT, pathname));
  // a bare startsWith lets /..%2Fdist-secret/x.js out of dist/ into its siblings:
  // "/p/dist-secret" starts with "/p/dist". The separator is what makes it a prefix.
  if (!contains(SERVE_ROOT, file)) {
    res.writeHead(403).end();
    return;
  }
  let body;
  try {
    body = readFileSync(file);
  } catch {
    // favicon/touch-icon are requested by the browser itself, not by the page
    if (!/^\/(favicon\.ico|apple-touch-icon.*\.png)$/.test(pathname)) missing.push(pathname);
    res.writeHead(404, { "content-type": "text/plain" }).end("404");
    return;
  }
  const ext = extname(file).toLowerCase();
  if (ext === ".html") {
    const text = body.toString("utf8");
    const at = text.search(/<head[^>]*>/i);
    body = at >= 0
      ? text.slice(0, text.indexOf(">", at) + 1) + COLLECTOR + text.slice(text.indexOf(">", at) + 1)
      : COLLECTOR + text;
  }
  res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" }).end(body);
}

// ---------------------------------------------------------------------------
// Source self-check (grep pass over the project's own files)
// ---------------------------------------------------------------------------
const SCAN_EXT = new Set([".html", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".css", ".svg"]);
const SKIP_DIR = new Set(["node_modules", "dist", ".git", "verification-shots", "build", ".vite", "coverage"]);

function scanSources() {
  const hits = { random: [], todo: [], throws: [], external: [], unreadable: [] };
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      // a dangling symlink used to blow up statSync/readFileSync here — at the very
      // end of the run, after every screenshot had already been taken
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIR.has(entry.name) && !entry.name.startsWith(".")) walk(full);
        continue;
      }
      try {
        if (!SCAN_EXT.has(extname(entry.name).toLowerCase())) continue;
        if (entry.name === "verify-content.mjs") continue;          // this file is a process artifact
        if (statSync(full).size > 1024 * 1024) continue;
        const rel = relative(PROJECT, full);
        const lines = readFileSync(full, "utf8").split("\n");
        lines.forEach((line, i) => {
          const where = `${rel}:${i + 1}`;
          if (/\bMath\.random\s*\(/.test(line)) hits.random.push(where);
          if (/\b(TODO|FIXME|XXX)\b/.test(line)) hits.todo.push(where);
          if (/throw\s+new\s+Error/.test(line)) hits.throws.push(where);
          for (const m of line.matchAll(/https?:\/\/[^\s"'`)]+/g)) {
            const u = m[0];
            if (/localhost|127\.0\.0\.1|0\.0\.0\.0|w3\.org|schema\.org|\.local\b/.test(u)) continue;
            hits.external.push(`${where} ${u.slice(0, 70)}`);
          }
        });
      } catch (error) {
        hits.unreadable.push(`${relative(PROJECT, full)} (${error.code ?? error.message})`);
      }
    }
  };
  walk(PROJECT);
  return hits;
}

const sample = (list, n = 3) => list.slice(0, n).join(", ") + (list.length > n ? ` (+${list.length - n} more)` : "");

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
if (!existsSync(join(SERVE_ROOT, ARGS.page))) {
  console.error(`VERIFY FAIL: ${join(SERVE_ROOT, ARGS.page)} does not exist.`);
  console.error(SERVE_ROOT === PROJECT
    ? "  nothing to serve — build the piece first, or pass --page <file>."
    : "  dist/ exists but has no entry page — re-run `npm run build`.");
  process.exit(1);
}

/**
 * Empty the shots directory — but only of files this script wrote.
 *
 * Nothing here is recursive and nothing unknown is touched: if --out points at a
 * directory holding anything else, that is a sign it is not a scratch directory,
 * and the run stops instead of deleting someone's work.
 */
const SHOT_ARTIFACT = /^(?:[\w.-]+\.png|README\.txt)$/i;

function prepareShotsDir() {
  if (!existsSync(SHOTS)) {
    mkdirSync(SHOTS, { recursive: true });
    return;
  }
  let entries;
  try {
    entries = readdirSync(SHOTS, { withFileTypes: true });
  } catch (error) {
    die(`cannot read the --out directory ${SHOTS}: ${error.message}`);
  }
  const strangers = entries.filter((e) => !e.isFile() || !SHOT_ARTIFACT.test(e.name));
  if (strangers.length) {
    const names = strangers.slice(0, 5).map((e) => e.name).join(", ");
    die(`the --out directory ${SHOTS} holds entries this script did not write:\n`
      + `  ${names}${strangers.length > 5 ? ` (+${strangers.length - 5} more)` : ""}\n`
      + "  it is emptied on every run, so it must contain probe output only (*.png, README.txt).\n"
      + "  point --out at a fresh sub-directory, e.g. --out verification-shots.");
  }
  for (const entry of entries) rmSync(join(SHOTS, entry.name), { force: true });
}

prepareShotsDir();

await new Promise((done, fail) => {
  // without an error listener a failed listen() leaves this promise pending forever
  const onError = (error) => fail(error);
  server.once("error", onError);
  server.listen(0, "127.0.0.1", () => {
    server.removeListener("error", onError);
    done();
  });
}).catch((error) => {
  console.error(`VERIFY FAIL: could not start the local server: ${error.message}`);
  process.exit(1);
});
server.on("error", (error) => console.error(`verify-content: server error — ${error.message}`));
const PORT = server.address().port;
const pageUrl = (query = "") => `http://127.0.0.1:${PORT}/${ARGS.page}${query}`;

console.log(`verify-content: serving ${SERVE_ROOT} on :${PORT}`);
console.log(`verify-content: browser ${BROWSER}`);

// 1) probe: does the page expose the contract, and did anything blow up?
const probeUrl = `http://127.0.0.1:${PORT}${PROBE_PATH}?target=${encodeURIComponent("/" + ARGS.page)}`;
const dump = await chrome([`--virtual-time-budget=${ARGS.budget}`, "--dump-dom", probeUrl],
  { marker: /VERIFY_PROBE_JSON:([^<\s]+)/ });
let probe = null;
if (dump.found) {
  try { probe = JSON.parse(decodeURIComponent(dump.found[1])); } catch { probe = null; }
}
if (!probe || !probe.ok) {
  warn("page probe", `could not read the page from the probe frame${probe?.error ? `: ${probe.error}` : ""}`);
} else {
  ok("page loads", `${probe.nodes} DOM nodes, ${probe.canvases} canvas, ${probe.svgs} svg, title "${probe.title}"`);
  if (probe.errors.length) bad("page errors", `${probe.errors.length}: ${probe.errors[0]}`);
  else ok("no page errors", "window.onerror / console.error clean");
  if (probe.hasSeek) ok("window.__seek exposed", "screenshots can freeze any moment");
  else warn("window.__seek missing", "expose __seek(t) so a single frame can be reproduced (required for the loop check)");
  if (probe.sceneReady) ok("window.__SCENE_READY__ set", "");
  else warn("window.__SCENE_READY__ missing", "screenshot tooling has nothing to wait on");
}

// 2) full view + thumbnail
const full = await screenshot(pageUrl(), "01-full.png", 1440, 900);
const thumb = await screenshot(pageUrl(), "02-thumb.png", 520, 340);
if (full) ok("full view 1440x900", "01-full.png");
if (thumb) ok("thumbnail 520x340", "02-thumb.png — subject, depth order and focal point must still read here");

// 3) is it actually a picture, or a blank canvas?
if (full) {
  const stats = py({ op: "stats", src: full });
  if (!stats) {
    bad("pixel statistics", "3D Python measurement failed — blank-page detection was not completed");
  } else {
    const spread = Math.max(...stats.stddev);
    const detail = `mean ${stats.mean.join("/")} · stddev ${stats.stddev.join("/")}`;
    if (spread < 3) bad("page is blank or uniform", detail);
    else ok("page has real content", detail);
  }
}

// 4) local crops — structure region and repeated-detail region
if (full) {
  const W = 1440, H = 900;
  const structure = py({
    op: "crop", src: full, dst: join(SHOTS, "03-crop-structure.png"),
    box: [W * 0.18, H * 0.12, W * 0.82, H * 0.88], zoom: 1,
  });
  const detail = py({
    op: "crop", src: full, dst: join(SHOTS, "04-crop-detail.png"),
    box: [W * 0.34, H * 0.42, W * 0.66, H * 0.86], zoom: 2,
  });
  if (structure) ok("structure crop", "03-crop-structure.png — silhouette, composition, depth order");
  if (detail) ok("repeated-detail crop", "04-crop-detail.png (2x) — per-instance variation, edges, contact shadows");
  if (!structure && !detail) bad("local crops", "3D Python measurement failed — crops were not generated");
}

// 5) loop seam: t=0 and t=T must be pixel-identical.
// This is one of the three checks the skill documents, so it runs by default: when
// --loop is absent the duration is inferred from the source. guessDuration() could
// already read DURATION out of the code — it used to spend the answer on a warning
// and take no screenshots, so a documented run came back green with the seam
// never compared. Only a piece whose duration cannot be inferred is skipped.
let loopSeconds = ARGS.loop;
let loopInferred = false;
if (loopSeconds === null && !ARGS.noLoop) {
  const guess = guessDuration();
  if (guess !== null && guess > 0) {
    loopSeconds = guess;
    loopInferred = true;
  }
}
const loopHow = loopInferred ? `DURATION = ${loopSeconds} inferred from the source` : `--loop ${loopSeconds}`;

if (ARGS.noLoop) {
  warn("loop check skipped", "--no-loop was passed — the t=0/t=T seam was not compared");
} else if (loopSeconds === null) {
  warn("loop check skipped", "no --loop given and no DURATION constant found in the source; "
    + "pass --loop <seconds> for a looped piece (a static piece needs no loop check)");
} else if (probe && probe.ok && !probe.hasSeek && !loopInferred) {
  bad("loop check impossible", "--loop was given but window.__seek is missing, so ?t= cannot freeze a frame");
} else if (probe && probe.ok && !probe.hasSeek) {
  warn("loop check skipped", `${loopHow}, but window.__seek is missing, so ?t= cannot freeze a frame — `
    + "expose __seek(t) and re-run, or pass --no-loop for a static piece");
} else {
  const T = loopSeconds;
  if (loopInferred) console.log(`verify-content: no --loop given — checking the loop seam with ${loopHow}`);
  const a = await screenshot(pageUrl(`?t=0`), "05-loop-t0.png", 1440, 900);
  const b = await screenshot(pageUrl(`?t=${T}`), "06-loop-tEnd.png", 1440, 900);
  const mid = await screenshot(pageUrl(`?t=${(T / 2).toFixed(3)}`), "07-loop-mid.png", 1440, 900);
  const seam = a && b ? py({ op: "diff", a, b }) : null;
  if (!seam) {
    bad("loop seam", "pixel comparison was not completed — the seam has not been verified");
  } else if (seam.error) {
    bad("loop seam", seam.error);
  } else if (seam.maxdiff === 0) {
    ok("loop seam is clean", `t=0 vs t=${T}: maxdiff 0 (${loopHow})`);
  } else {
    bad("loop seam jumps", `t=0 vs t=${T}: maxdiff ${seam.maxdiff}, ${seam.changed_pct}% of pixels differ, bbox ${JSON.stringify(seam.bbox)} (${loopHow})`);
  }
  const moved = a && mid ? py({ op: "diff", a, b: mid }) : null;
  if (moved && !moved.error) {
    if (moved.maxdiff === 0) warn("?t= may be ignored", `t=0 and t=${T / 2} are identical — check that ?t= reaches __seek(t)`);
    else ok("?t= drives the scene", `t=0 vs t=${T / 2}: ${moved.changed_pct}% of pixels differ`);
  }
}

function guessDuration() {
  // one unreadable file (or a missing src/) must not abort the whole guess —
  // the loop check now depends on this answer, not just on a warning message
  // src/ first (the constant lives in the source), then the built output: a Vite
  // build leaves the bundle in dist/assets/, so dist/ alone would not find it
  const dirs = [join(PROJECT, "src"), join(SERVE_ROOT, "src"), join(SERVE_ROOT, "assets"), SERVE_ROOT, PROJECT];
  for (const dir of dirs) {
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (!SCAN_EXT.has(extname(name).toLowerCase())) continue;
      try {
        const m = readFileSync(join(dir, name), "utf8").match(/DURATION\s*=\s*([0-9.]+)/);
        if (m) {
          const value = Number(m[1]);
          if (Number.isFinite(value) && value > 0) return value;
        }
      } catch { /* unreadable file — keep looking */ }
    }
  }
  return null;
}

// 6) 404s seen by the server
if (missing.length) bad("missing files (404)", sample([...new Set(missing)]));
else ok("no 404s", "every request the page made was served");

// 7) source self-check
const hits = scanSources();
if (hits.random.length) bad("unseeded Math.random()", sample(hits.random) + " — seed it (mulberry32) or the piece is not reproducible");
else ok("no unseeded Math.random()", "");
if (hits.todo.length) warn("TODO/FIXME left in source", sample(hits.todo));
if (hits.throws.length) warn("throw new Error left in source", sample(hits.throws));
if (hits.external.length) warn("external URLs in source", sample(hits.external) + " — bundle the asset or confirm it is intentional");
if (hits.unreadable.length) warn("source files that could not be read", sample(hits.unreadable) + " — dangling symlink or bad permissions; they were skipped, not scanned");
if (!hits.todo.length && !hits.throws.length && !hits.external.length) ok("source self-check clean", "no TODO, no leftover throws, no unexpected external URLs");

try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* best effort */ }
try { rmSync(LOG, { force: true }); } catch { /* best effort */ }
writeFileSync(join(SHOTS, "README.txt"),
  "Process artifacts from scripts/verify-content.mjs.\nReview the images, fix the worst defect, re-run, then DELETE this directory before delivery.\n");
finish(server);
