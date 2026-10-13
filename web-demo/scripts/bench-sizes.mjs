/**
 * Headless Chrome size/memory bench for POC_NOTES.md.
 * Measures sample + ~10/50/200 MiB synthetics. No product changes.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = join(root, "artifacts");
mkdirSync(artifacts, { recursive: true });

const BASE = process.env.DEMO_URL || "http://127.0.0.1:4173";

function miB(n) {
  return +(n / (1024 * 1024)).toFixed(3);
}

async function measureOnPage(page, spec) {
  return page.evaluate(async (s) => {
    const heap = () => performance.memory?.usedJSHeapSize ?? null;
    const samples = [];
    const sampleHeap = () => {
      const h = heap();
      if (h != null) samples.push(h);
    };

    if (typeof gc === "function") gc();
    sampleHeap();
    const memBaseline = heap();

    if (s.mode === "sample") {
      const started = performance.now();
      const interval = setInterval(sampleHeap, 20);
      const result = await window.__tgDemo.scanSample();
      clearInterval(interval);
      sampleHeap();
      return {
        ok: true,
        id: s.id,
        totalBytes: result.meta.total_bytes,
        findingCount: result.findings.length,
        wallMs: performance.now() - started,
        wasmMs: result.meta.elapsed_ms,
        memBaseline,
        memAfter: heap(),
        memPeak: samples.length ? Math.max(...samples) : heap(),
        memPeakDelta:
          memBaseline != null && samples.length
            ? Math.max(...samples) - memBaseline
            : null,
        error: null,
      };
    }

    const line =
      "2026-10-13T14:00:00Z INFO healthy heartbeat ok checksum=deadbeef padding=" +
      "x".repeat(80) +
      "\n";
    const needle =
      "2026-10-13T14:23:05Z FATAL unhandled exception in api worker (core dumped)\n";
    const target = s.targetBytes;
    const repeats = Math.ceil(target / line.length);
    let content = line.repeat(repeats);
    content = content.slice(0, Math.max(0, target - needle.length)) + needle;
    sampleHeap();
    const memAfterAlloc = heap();

    const started = performance.now();
    const interval = setInterval(sampleHeap, 20);
    let result = null;
    let error = null;
    try {
      result = await window.__tgDemo.scanSources(
        [{ name: `${s.id}.log`, content }],
        "incident-reliability",
      );
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    clearInterval(interval);
    sampleHeap();
    const wallMs = performance.now() - started;
    const memAfter = heap();
    content = "";
    if (typeof gc === "function") gc();

    if (error) {
      return {
        ok: false,
        id: s.id,
        totalBytes: target,
        findingCount: 0,
        wallMs,
        wasmMs: null,
        memBaseline,
        memAfterAlloc,
        memAfter,
        memPeak: samples.length ? Math.max(...samples) : memAfter,
        memPeakDelta:
          memBaseline != null && samples.length
            ? Math.max(...samples) - memBaseline
            : null,
        error,
      };
    }

    return {
      ok: true,
      id: s.id,
      totalBytes: result.meta.total_bytes,
      findingCount: result.findings.length,
      hasFatal: result.findings.some((f) => f.signature_id === "fatal-error-crash"),
      wallMs,
      wasmMs: result.meta.elapsed_ms,
      memBaseline,
      memAfterAlloc,
      memAfter,
      memPeak: samples.length ? Math.max(...samples) : memAfter,
      memPeakDelta:
        memBaseline != null && samples.length
          ? Math.max(...samples) - memBaseline
          : null,
      error: null,
    };
  }, spec);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"],
  });

  const cases = [
    { id: "sample", mode: "sample" },
    { id: "synth-10mb", mode: "synth", targetBytes: 10 * 1024 * 1024 },
    { id: "synth-50mb", mode: "synth", targetBytes: 50 * 1024 * 1024 },
    { id: "synth-200mb", mode: "synth", targetBytes: 200 * 1024 * 1024 },
  ];

  const results = [];

  for (const c of cases) {
    const page = await browser.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__tgDemo));
    await page.evaluate(async () => {
      await window.__tgDemo.ensureWasm();
      if (typeof gc === "function") gc();
    });

    const out = await measureOnPage(page, c);
    results.push({
      ...out,
      totalMiB: out.totalBytes != null ? miB(out.totalBytes) : null,
      memBaselineMiB: out.memBaseline != null ? miB(out.memBaseline) : null,
      memPeakMiB: out.memPeak != null ? miB(out.memPeak) : null,
      memPeakDeltaMiB: out.memPeakDelta != null ? miB(out.memPeakDelta) : null,
      wallMs: out.wallMs != null ? +out.wallMs.toFixed(1) : null,
      wasmMs: out.wasmMs != null ? +Number(out.wasmMs).toFixed(1) : null,
    });
    console.error(
      `${out.id}: ok=${out.ok} wall=${out.wallMs?.toFixed?.(1)} wasm=${out.wasmMs} peakΔMiB=${out.memPeakDelta != null ? miB(out.memPeakDelta) : null} err=${out.error}`,
    );
    await page.close();
  }

  await browser.close();

  const report = {
    measuredAt: new Date().toISOString(),
    browser: "Chromium (Playwright headless) + --enable-precise-memory-info",
    notes: [
      "usedJSHeapSize is Chrome's sampled JS heap, not process RSS; crossing into wasm linear memory roughly doubles resident string cost.",
      "Per-source hard cap: traceglass::scan::MAX_SOURCE_BYTES = 50 MiB; UI rejects text files above that before scan.",
      "200 MiB is expected to fail at the 50 MiB guard (no scan).",
    ],
    results,
  };

  writeFileSync(join(artifacts, "bench-sizes.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

await main();
