import init, {
  capabilities_json,
  scan_with_meta,
  scan_zip_bytes,
} from "../pkg/traceglass_wasm.js";
import wasmUrl from "../pkg/traceglass_wasm_bg.wasm?url";

type Finding = {
  source_file: string;
  line: number;
  severity: string;
  signature_id: string;
  title: string;
  category: string;
  explanation: string;
  evidence: string;
  lens_id: string;
  lens_group: string;
  lens_priority: number;
};

type ScanWithMeta = {
  findings: Finding[];
  meta: {
    source_count: number;
    total_bytes: number;
    elapsed_ms: number;
    finding_count: number;
    capabilities: Record<string, boolean>;
  };
};

const SAMPLE_FILES = [
  "samples/demo-bundle-case/app/api.log",
  "samples/demo-bundle-case/k8s/events.log",
  "samples/demo-bundle-case/edge/nginx-error.log",
  "samples/demo-bundle-case/db/postgres.log",
  "samples/demo-bundle-case/db/mysql.log",
  "samples/demo-bundle-case/system/journal.log",
] as const;

const LENS = "incident-reliability";

const REQUIRED_SIGNATURES = [
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
] as const;

let ready: Promise<void> | null = null;

function ensureWasm(): Promise<void> {
  if (!ready) {
    ready = init({ module_or_path: wasmUrl }).then(() => undefined);
  }
  return ready;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadSampleSources(): Promise<{ name: string; content: string }[]> {
  // Embed samples at build time so scanning never fetches log bytes over the network.
  const modules = import.meta.glob("../public/samples/demo-bundle-case/**/*.log", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const sources: { name: string; content: string }[] = [];
  for (const path of SAMPLE_FILES) {
    const suffix = path.replace(/^samples\//, "");
    const match = Object.keys(modules).find(
      (k) => k.endsWith(suffix) || k.endsWith(path.split("/").slice(-2).join("/")),
    );
    if (!match) {
      throw new Error(`sample not embedded: ${path}`);
    }
    const content = modules[match];
    const name = path.replace(/^samples\/demo-bundle-case\//, "");
    sources.push({ name, content });
  }
  return sources;
}

function renderFindings(listEl: HTMLElement, findings: Finding[]): void {
  listEl.replaceChildren();
  const sorted = [...findings].sort((a, b) => {
    const rank = (s: string) =>
      s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
    const d = rank(b.severity) - rank(a.severity);
    if (d !== 0) return d;
    return a.lens_priority - b.lens_priority || a.line - b.line;
  });
  for (const f of sorted) {
    const li = document.createElement("li");
    li.innerHTML = "";
    const sev = document.createElement("span");
    sev.className = `sev ${f.severity}`;
    sev.textContent = f.severity.toUpperCase();
    const title = document.createElement("strong");
    title.textContent = ` ${f.title}`;
    const where = document.createElement("div");
    where.className = "where";
    where.textContent = `${f.source_file}:${f.line} · ${f.signature_id} · ${f.lens_group}`;
    const evidence = document.createElement("p");
    evidence.className = "evidence";
    evidence.textContent = f.evidence;
    li.append(sev, title, where, evidence);
    listEl.append(li);
  }
}

async function typeLine(body: HTMLElement, text: string, cls: string, delay = 18): Promise<void> {
  const line = document.createElement("div");
  line.className = cls;
  body.append(line);
  body.parentElement?.scrollTo({ top: body.scrollHeight });
  for (let i = 0; i < text.length; i++) {
    line.textContent = text.slice(0, i + 1);
    if (delay > 0 && i % 3 === 0) await sleep(delay);
  }
  line.textContent = text;
}

async function runReplay(): Promise<void> {
  const btn = $("btn-replay") as HTMLButtonElement;
  const body = $("term-body");
  const status = $("term-status");
  const meta = $("replay-meta");
  const findingsPanel = $("replay-findings");
  const list = $("replay-list");

  btn.disabled = true;
  body.replaceChildren();
  findingsPanel.hidden = true;
  status.textContent = "loading wasm";
  meta.textContent = "";

  try {
    await ensureWasm();
    status.textContent = "scanning";
    await typeLine(body, "$ traceglass --lens incident-reliability samples/demo-bundle/case", "line-in", 8);
    await typeLine(body, "loading built-in signature library…", "line-out", 4);

    const sources = await loadSampleSources();
    await typeLine(
      body,
      `opened ${sources.length} text sources (${sources.reduce((n, s) => n + s.content.length, 0)} bytes)`,
      "line-out",
      4,
    );

    const started = performance.now();
    const result = (await scan_with_meta(JSON.stringify(sources), LENS)) as ScanWithMeta;
    const elapsed = performance.now() - started;

    const ids = new Set(result.findings.map((f) => f.signature_id));
    for (const required of REQUIRED_SIGNATURES) {
      if (!ids.has(required)) {
        throw new Error(`missing planted signature: ${required}`);
      }
    }

    await typeLine(
      body,
      `scan complete — ${result.findings.length} findings in ${elapsed.toFixed(1)} ms (wasm meta ${result.meta.elapsed_ms.toFixed(1)} ms)`,
      "line-out",
      4,
    );

    const crit = result.findings.filter((f) => f.severity === "critical");
    const high = result.findings.filter((f) => f.severity === "high");
    await typeLine(
      body,
      `severity mix: ${crit.length} critical · ${high.length} high · ${result.findings.length - crit.length - high.length} medium`,
      "line-find",
      4,
    );

    for (const f of result.findings.slice(0, 8)) {
      const cls = f.severity === "critical" ? "line-crit" : "line-find";
      await typeLine(
        body,
        `  ${f.severity.toUpperCase().padEnd(8)} ${f.source_file}:${f.line}  ${f.title}`,
        cls,
        2,
      );
    }
    if (result.findings.length > 8) {
      await typeLine(body, `  … ${result.findings.length - 8} more`, "line-out", 2);
    }

    renderFindings(list, result.findings);
    findingsPanel.hidden = false;
    status.textContent = "done";
    meta.textContent = `${result.findings.length} findings · ${elapsed.toFixed(1)} ms · ${result.meta.total_bytes} bytes`;

    const caps = $("caps");
    caps.hidden = false;
    caps.textContent = capabilities_json();
  } catch (err) {
    status.textContent = "error";
    await typeLine(body, `error: ${err instanceof Error ? err.message : String(err)}`, "line-crit", 0);
  } finally {
    btn.disabled = false;
  }
}

function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

async function scanUserFile(file: File): Promise<void> {
  const meta = $("try-meta");
  const panel = $("try-findings");
  const list = $("try-list");
  meta.textContent = `reading ${file.name}…`;
  panel.hidden = true;

  await ensureWasm();

  const started = performance.now();
  let rich: ScanWithMeta;

  if (isZipFile(file)) {
    if (file.size > 256 * 1024 * 1024) {
      meta.textContent = "zip exceeds 256 MiB demo limit";
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    rich = (await scan_zip_bytes(bytes, LENS)) as ScanWithMeta;
  } else {
    const content = await file.text();
    if (content.length > 50 * 1024 * 1024) {
      meta.textContent = "file exceeds 50 MiB demo limit";
      return;
    }
    rich = (await scan_with_meta(
      JSON.stringify([{ name: file.name, content }]),
      LENS,
    )) as ScanWithMeta;
  }

  const elapsed = performance.now() - started;
  renderFindings(list, rich.findings);
  panel.hidden = false;
  meta.textContent = `${file.name}: ${rich.findings.length} findings · ${elapsed.toFixed(1)} ms · ${rich.meta.total_bytes.toLocaleString()} bytes across ${rich.meta.source_count} source(s) (local only)`;
}

function wireDropzone(): void {
  const zone = $("dropzone");
  const input = $("file-input") as HTMLInputElement;

  const openPicker = () => input.click();
  zone.addEventListener("click", openPicker);
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  });

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void scanUserFile(file);
  });

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    const file = e.dataTransfer?.files?.[0];
    if (file) void scanUserFile(file);
  });
}

async function boot(): Promise<void> {
  $("btn-replay").addEventListener("click", () => void runReplay());
  wireDropzone();
  // Warm WASM in the background so the first click is snappy.
  void ensureWasm().catch(() => {
    /* surfaced on first action */
  });
}

void boot();

// Exported for Playwright tests via window
declare global {
  interface Window {
    __tgDemo?: {
      ensureWasm: typeof ensureWasm;
      loadSampleSources: typeof loadSampleSources;
      scanSample: () => Promise<ScanWithMeta>;
      scanSources: (
        sources: { name: string; content: string }[],
        lens?: string,
      ) => Promise<ScanWithMeta>;
      scanZipBytes: (bytes: Uint8Array, lens?: string) => Promise<ScanWithMeta>;
      requiredSignatures: typeof REQUIRED_SIGNATURES;
    };
  }
}

window.__tgDemo = {
  ensureWasm,
  loadSampleSources,
  requiredSignatures: REQUIRED_SIGNATURES,
  async scanSample() {
    await ensureWasm();
    const sources = await loadSampleSources();
    return (await scan_with_meta(JSON.stringify(sources), LENS)) as ScanWithMeta;
  },
  async scanSources(sources, lens = LENS) {
    await ensureWasm();
    return (await scan_with_meta(JSON.stringify(sources), lens)) as ScanWithMeta;
  },
  async scanZipBytes(bytes, lens = LENS) {
    await ensureWasm();
    return (await scan_zip_bytes(bytes, lens)) as ScanWithMeta;
  },
};
