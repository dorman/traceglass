import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = join(root, "artifacts");

const REQUIRED = [
  "fatal-error-crash",
  "resource-exhaustion",
  "kubernetes-workload-failure",
  "container-runtime-failure",
  "nginx-upstream-failure",
  "postgresql-connection-transaction-failure",
  "mysql-storage-concurrency-failure",
  "connection-refused-reset",
  "systemd-unit-failure",
  "diagnostic-assertion-traceback",
];

test.beforeAll(() => {
  mkdirSync(artifacts, { recursive: true });
});

test("wasm bundle size is reported", async () => {
  const wasmPath = join(root, "pkg", "traceglass_wasm_bg.wasm");
  const bytes = readFileSync(wasmPath);
  const raw = bytes.byteLength;
  const gzip = gzipSync(bytes).byteLength;
  writeFileSync(
    join(artifacts, "wasm-size.json"),
    JSON.stringify(
      {
        rawBytes: raw,
        gzipBytes: gzip,
        rawMiB: +(raw / (1024 * 1024)).toFixed(3),
        gzipMiB: +(gzip / (1024 * 1024)).toFixed(3),
      },
      null,
      2,
    ) + "\n",
  );
  expect(raw).toBeGreaterThan(10_000);
  expect(gzip).toBeLessThan(raw);
  console.log(`WASM size raw=${raw} gzip=${gzip}`);
});

test("sample scan produces planted findings with no post-load network", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    requests.push(req.url());
  });

  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__tgDemo));
  await page.waitForTimeout(500);
  const loadCount = requests.length;
  requests.length = 0;

  const result = await page.evaluate(async () => {
    return window.__tgDemo!.scanSample();
  });

  expect(result.findings.length).toBeGreaterThanOrEqual(10);
  const ids = new Set(result.findings.map((f) => f.signature_id));
  for (const required of REQUIRED) {
    expect(ids.has(required), `missing ${required}`).toBeTruthy();
  }
  expect(result.findings.some((f) => f.severity === "critical")).toBeTruthy();
  expect(requests, `unexpected post-load requests: ${requests.join(", ")}`).toEqual(
    [],
  );

  writeFileSync(
    join(artifacts, "sample-scan.json"),
    JSON.stringify(
      {
        findingCount: result.findings.length,
        elapsedMs: result.meta.elapsed_ms,
        totalBytes: result.meta.total_bytes,
        loadRequestCount: loadCount,
        postLoadRequestCount: requests.length,
        signatureIds: [...ids].sort(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `sample scan findings=${result.findings.length} wasmMs=${result.meta.elapsed_ms}`,
  );
});

test("try-your-own path scans a File without uploading", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => requests.push(req.url()));

  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__tgDemo));
  await page.waitForTimeout(500);
  requests.length = 0;

  const sample = readFileSync(
    join(root, "public/samples/demo-bundle-case/app/api.log"),
    "utf8",
  );

  await page.setInputFiles("#file-input", {
    name: "user-api.log",
    mimeType: "text/plain",
    buffer: Buffer.from(sample),
  });

  await expect(page.locator("#try-findings")).toBeVisible({ timeout: 30_000 });
  const count = await page.locator("#try-list li").count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator("#try-meta")).toContainText("local only");
  expect(requests, `upload-like requests: ${requests.join(", ")}`).toEqual([]);
});

test("50MB synthetic log scan timing in Chromium", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__tgDemo));
  await page.evaluate(async () => {
    await window.__tgDemo!.ensureWasm();
  });

  const perf = await page.evaluate(async () => {
    const heap = () =>
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize ?? null;

    // Force GC hint when available (Chrome --js-flags=--expose-gc is not set;
    // we still record whatever the heap sampler exposes).
    const memBaseline = heap();

    const line =
      "2026-10-13T14:00:00Z INFO healthy heartbeat ok checksum=deadbeef padding=" +
      "x".repeat(80) +
      "\n";
    const needle =
      "2026-10-13T14:23:05Z FATAL unhandled exception in api worker (core dumped)\n";
    const target = 50 * 1024 * 1024;
    const repeats = Math.ceil(target / line.length);
    let content = line.repeat(repeats);
    content = content.slice(0, target - needle.length) + needle;
    const memAfterAlloc = heap();

    const started = performance.now();
    const out = await window.__tgDemo!.scanSources(
      [{ name: "synthetic-50mb.log", content }],
      "incident-reliability",
    );
    const elapsedMs = performance.now() - started;
    const memAfterScan = heap();

    return {
      elapsedMs,
      wasmElapsedMs: out.meta.elapsed_ms,
      totalBytes: out.meta.total_bytes,
      findingCount: out.findings.length,
      hasFatal: out.findings.some((f) => f.signature_id === "fatal-error-crash"),
      memBaseline,
      memAfterAlloc,
      memAfterScan,
      memAllocDelta:
        memBaseline != null && memAfterAlloc != null
          ? memAfterAlloc - memBaseline
          : null,
      memScanDelta:
        memAfterAlloc != null && memAfterScan != null
          ? memAfterScan - memAfterAlloc
          : null,
      contentLen: content.length,
      heapApiAvailable: memBaseline != null,
    };
  });

  expect(perf.totalBytes).toBeGreaterThan(45 * 1024 * 1024);
  expect(perf.hasFatal).toBeTruthy();
  expect(perf.findingCount).toBeGreaterThan(0);

  writeFileSync(join(artifacts, "perf-50mb.json"), JSON.stringify(perf, null, 2) + "\n");
  console.log(
    `50MB scan wall=${perf.elapsedMs.toFixed(1)}ms wasm=${perf.wasmElapsedMs.toFixed(1)}ms findings=${perf.findingCount} heapApi=${perf.heapApiAvailable} allocΔ=${perf.memAllocDelta} scanΔ=${perf.memScanDelta}`,
  );
});
