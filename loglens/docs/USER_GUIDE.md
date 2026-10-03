# loglens User Guide

loglens is an interactive terminal UI for reading logs: it highlights the
terms you care about, scans for curated diagnostic signatures with zero
configuration, and collapses big files down to just the lines worth reading.
Keyword and regex highlights are user-controlled entries in a local watchlist;
the built-in signature catalog is separate. Pipes and explicit output formats
stay non-interactive for automation. The watchlist needs no AI, network access,
or uploaded logs.

This guide covers everything. For a 2-minute intro, see the
[README](../README.md).

---

## Contents

1. [Installation](#installation)
2. [Opening logs](#opening-logs)
3. [First-run walkthrough](#first-run-walkthrough)
4. [The viewer](#the-viewer)
5. [Scan: automatic triage](#scan-automatic-triage)
6. [Highlights](#highlights)
7. [Watchlist workspace](#watchlist-workspace)
8. [Search & filter](#search--filter)
9. [Settings](#settings)
10. [Mouse reference](#mouse-reference)
11. [Keybinding reference](#keybinding-reference)
12. [Command-line reference](#command-line-reference)
13. [Limits & safety](#limits--safety)
14. [Troubleshooting](#troubleshooting)

---

## Installation

The LogSift one-click beta installer is the primary non-developer path. It is
planned for Linux glibc x86_64, macOS Apple silicon, macOS Intel, and Windows
x86_64. The website keeps a target unavailable until its native installer,
CLI payload, signed Ed25519 manifest, detached signatures, and SHA-256 values
are published together.

Download the exact target installer locally from
[GitHub Releases](https://github.com/dorman/loglens/releases) and run it. The
installer verifies the canonical release URL/path, signed manifest, payload
signature and hash, safe archive entries, and the extracted executable before
any install write. It never executes remote commands or downloaded scripts.

The default is a current-user install. It explains UAC, Gatekeeper, and
permission prompts and asks before PATH changes, shortcut creation, and opening
a new terminal. With launch consent, the new terminal starts the no-argument
interactive welcome/browser TUI. File, stdin, pipe, raw, JSON, and CSV modes
remain available. There is no log upload, telemetry, service, or silent update.

Ed25519 release signatures do not mean Windows Authenticode, macOS Developer
ID, or notarization is present; those are separately documented only when the
publisher credentials exist.

The exact target pairs are Linux glibc x86_64 with
`loglens-installer-x86_64-unknown-linux-gnu` and a `.tar.gz` payload, macOS
Apple silicon with `loglens-installer-aarch64-apple-darwin` and a `.tar.gz`
payload, macOS Intel with `loglens-installer-x86_64-apple-darwin` and a
`.tar.gz` payload, and Windows x86_64 with
`loglens-installer-x86_64-pc-windows-msvc.exe` and a `.zip` payload.

### Technical source fallback

Requires Rust **1.85+** (`edition = "2024"`):

```sh
git clone https://github.com/dorman/loglens.git
cd loglens
cargo install --path . --locked
```

### Contributor source build

Contributors who need to change the crate can build from a clone:

```sh
git clone https://github.com/dorman/loglens.git
cd loglens
cargo build --locked
cargo test --locked
cargo clippy --all-targets --locked -- -D warnings
cargo fmt --check
```

### Updating

For a source installation, update with:

```sh
cargo install --path . --force --locked
```

For a contributor clone, re-run the local install command with `--force`:

```sh
cargo install --path . --force --locked   # from a clone (after git pull)
```

### Uninstalling

```sh
cargo uninstall loglens
```

---

## Opening logs

### From the command line

```sh
loglens                          # no args: welcome screen
loglens agent.log                # a single file
loglens a.log b.log c.log        # several files -> tabs
loglens ./diagnostic-bundle/     # a folder: every text log inside, recursive
loglens support-collection.zip   # a zip: extracted and loaded the same way
```

A regular file path opens the TUI and scans on open when stdout and stdin are
interactive. If stdin is piped, or stdout is redirected, the default is
sanitized raw text. Use `--format raw`, `--format json`, or `--format csv` to
select a machine mode explicitly; `--stdin` forces stdin input.

JSON output is an array of records with `file`, `line`, `raw`, `message`,
`severity`, and optional finding evidence. CSV uses the stable header
`file,line,severity,message,evidence,raw,signature_id,source,catalog,version,set,pattern,severity_rationale,explanation,false_positive_note,matched_evidence,lens_id,lens_version,lens_group,lens_priority`. JSON/NDJSON and CSV parse failures
warn on stderr and retain line-level records. `.csb` is treated as CSV.

Folders and zips are loaded recursively. Every text log becomes its own tab,
named by its relative path (`AV/agent.log`, `system/network.log`). Binary
files are detected and skipped automatically, so a bundle full of `.db` /
`.bin` files remain usable. Empty files, files over **50 MiB**, and files whose
first 8 KiB contain a NUL byte are skipped during collection; a direct open
of a file above 50 MiB is rejected too.

Zip archives are extracted to a temporary directory and hardened against
hostile input (path traversal / zip-slip, archive-size and extract-size
caps, entry-count limits). The extract directory is created fresh — never
reusing an existing path — and on Linux/macOS it is owner-only (`0700`), so
bundle contents are not readable by other users on a shared machine. It is
removed when loglens exits. Auto-collection never follows symlinks and stops
at depth 32 / 2,000 files per resolve — see [Limits & safety](#limits--safety).

### From inside the TUI (the file browser)

Press `o` anywhere to open the file browser popup. The browser reopens at the
last directory you visited (saved in `~/.config/loglens/config`) when that path
still exists; otherwise it starts in the process working directory.

| Key | Action |
| --- | ------ |
| `j` / `k` (or arrows) | move selection |
| `Enter` / `l` | enter a directory, or open the selected file |
| `h` / `Backspace` | go to the parent directory |
| `Space` | mark/unmark a file (mark several to open together) |
| `o` | open all marked files |
| `O` | open the selected folder or `.zip` recursively |
| `.` | show/hide hidden files |
| `q` / `Esc` | close the browser |

You can also click an entry to select it, and wheel-scroll the list.

### Managing open files

- `Tab` / `]` — next tab
- `Shift-Tab` / `[` — previous tab
- click a tab — switch to that file
- `w` — close the current file
- `o` — reopen the browser to add more

## First-run walkthrough

The first interactive launch offers a short, optional walkthrough before the
normal welcome/viewer flow. It has four pages:

1. opening a file, folder, or ZIP bundle with `o`, browser navigation, and the
   command line;
2. choosing `General Triage`, `Incident / Reliability`, or `Security Signals`
   with `L`;
3. searching with `/`, filtering with `f`, and clearing with `c`;
4. reading and exporting findings with `S`, `s`, `Enter`, and `e`.

Press `Enter` to start. Press `s` or `Esc` on the prompt to skip and remember
that choice. While reading, `←`/`→`, `Enter`, or Space moves between pages;
`s` skips and `Esc` closes. A completed or skipped walkthrough does not appear
automatically again. Press `T` from the welcome/viewer/help surface or run
`loglens --walkthrough` to replay it.

The state is best-effort local preference data in the same `config` file as
the other settings, under the platform config directory or
`LOGLENS_CONFIG_DIR`. It does not create an account, send telemetry, upload
logs, or make network calls. Machine modes (pipes, redirected output,
`--format`, and `--findings`) never initialize the TUI or print walkthrough
copy. Findings and signals remain evidence for human review, not malware
verdicts, security determinations, or completeness claims.

---

## The viewer

The main screen shows the current log with line numbers, your keyword and regex highlights
colored inline, and (after a scan) a severity dot in the gutter next to
flagged lines. Bookmarked lines show a diamond (`◆`) in the gutter (and keep
an accent-tinted line number even when a severity dot is also present).

Navigation:

| Key | Action |
| --- | ------ |
| `j` / `k`, `↓` / `↑` | one line down / up |
| `←` / `→` | pan left / right by 8 columns (long lines that clip at the edge) |
| `0` | reset horizontal scroll to column 1 |
| `Ctrl-d` / `Ctrl-u`, `Space` / `PgDn`, `PgUp` | one page down / up |
| `g` / `G`, `Home` / `End` | top / bottom |
| `:` | go to line number (1-based; clamps past the end) |
| `m` | toggle a bookmark on the current line |
| `M` | clear all bookmarks on the current file |
| `'` / `"` | next / previous bookmark (wraps; clears filter if the mark is hidden) |
| `y` | copy the cursor line to the system clipboard (OSC-52) |
| `Y` | copy the current file's path to the system clipboard (OSC-52) |
| `Enter` | jump to the first match (highlights, or search results while searching) |
| `n` / `N` | next / previous match (wraps; highlights, or search results while searching) |

The scrollbar on the right edge shows your position — click anywhere on it to
jump, or drag the thumb.

The status bar stays short on purpose: absolute line (`L42/1200`), highlight
count, filter/search state, truncation hint, ignore-case (`ic` when on),
bookmark count (when any), horizontal column (`col N` when panned), and
cached finding count (`N fd` after a scan) — full keybindings live behind
`?`. Press `:` to jump straight to a line number.

Log lines are soft-tinted by level tokens even before you add a keyword or regex highlight
(`ERROR` / `ERR` / `FATAL` / `CRITICAL` / `CRIT`, `WARN` / `WARNING`,
`INFO`, `DEBUG` / `TRACE`). Matching is word-token based (so `TERROR` does
not tint), and the highest severity wins when several tokens appear on one
line.

---

## Scan: automatic triage

**A scan starts on its own.** Opening anything — a file from the command line,
a selection from the browser, a folder or `.zip` — runs every open file through
the curated, versioned built-in signature catalog and presents a **findings panel**
ranked by severity. No keywords, no setup, no keystroke.

While it runs, the progress bar is the report assembling: its length is real
progress and its color is the severity mix found so far, so a bar that stays
accent-blue means nothing has turned up yet. `Esc` cancels at any point.

Press **`S`** to rescan (after adding highlights, or on files opened with
`--no-scan`). Findings are global, so opening more files rescans the whole set
and keeps one complete report. Pass `--no-scan` when you want to open a large
bundle just to read it.

Built-in signatures are immutable scan metadata: their findings are not added
to the local watchlist and are never saved in `watchlist.json`. No candidate
suggestions are generated today; a future suggestion would remain only a
suggestion until you explicitly accepted it.

### Review lenses

Every run uses the versioned `v0.1.0` lens catalog. `general-triage` is the
default. `incident-reliability` prioritizes availability/dependencies,
runtime/deployment, capacity, and diagnostics. `security-signals` prioritizes
protection/integrity, execution/persistence, identity/audit, and then other
evidence. Use `--lens <id>` in machine or interactive mode, or press `L` in
the viewer/findings panel. The chooser accepts `j/k`, `1/2/3`, Enter, and Esc.

The chosen lens changes only review grouping and deterministic priority. All
matches, source lines, repeated occurrences, jump targets, severity,
provenance, explanation, rationale, and false-positive notes remain visible.
Unsupported external or legacy evidence goes to `other-evidence`. Changing a
lens re-ranks cached findings without a rescan and never changes the local
watchlist. Lens metadata is context for human review, not a security verdict,
detection-completeness claim, or AI classification.

When a scan finds nothing, no panel opens — the status line reports what was
covered instead, e.g. `scan complete — nothing notable in 9004 lines across 3
files`.

What the library covers: security tampering (protection disabled), encoded
PowerShell commands, process injection, commonly-abused system binaries
(LOLBins), clock/time rollback, certificate-validation failures, corrupt
signature databases, crashes and fatal errors, resource exhaustion
(OOM / disk full), connection refusals, update failures, installer rollbacks,
access-denied errors, Docker/container runtime failures, Kubernetes restart and
probe failures, systemd/journal failures, nginx upstream failures, MySQL and
PostgreSQL database failures, Windows Event audit failures, antivirus/EDR
signals, Splunk search/indexer failures, and generic diagnostic tracebacks.
Findings are **Medium severity and above** so a noisy ERROR/WARN flood cannot
bury real triage signals — use keyword highlights (`a` / `-k ERROR,WARN`) when
you want every error line.

In the findings panel:

- The **severity bar** across the top shows the crit/high/med/low/info mix at
  a glance.
- Each finding shows its severity badge, title, and `file:line`.
- The **detail box** explains *why the selected finding matters* in plain
  English, with the matched log line.
- `j`/`k` move · `Enter` (or click a row) jumps straight to that line ·
  `e` exports a markdown summary · `q`/`Esc` closes.

After a scan, flagged lines keep a colored **severity dot** in the gutter, so
trouble stays visible while you read normally. Press **`p`** / **`P`** to walk
next / previous finding in severity order without reopening the panel (wraps;
status shows `finding i/n · SEV · title · file:line`). Press **`s`** to reopen
the findings panel without rescanning (status bar shows `N fd` while findings
are cached). Press **`e`** anytime after a scan to write `loglens-findings.md`
in the current directory — a short triage dump with severity, location, why it
matters, and the matched line. An earlier export is never overwritten: if
`loglens-findings.md` already exists the next one becomes
`loglens-findings-2.md`, then `-3.md`, and the status line reports the exact
path written. The status shows the absolute path, since the export lands in the
directory loglens was started from, not necessarily where the logs came from.

Long scans (large bundles) show a live progress bar with a running findings
count — press `Esc` or `q` to cancel. Cancelling clears any partial severity
dots so the file does not look half-scanned. The findings panel itself caps
at 10,000 hits; if that ceiling is hit the status reads
`scan: N+ findings (capped)` while gutter severity dots still reflect every
matched line.

---

## Keyword and regex highlights

Keyword and regex highlights are your own tracked terms — like Grammarly
underlines, but for the strings you care about. Pressing `a` or `r` adds the
chosen highlight as a user-controlled entry in the local watchlist; each rule
gets a distinct color, shown in the legend panel on the right with a live match
count. These entries are separate from curated built-in signature findings.

| Key | Action |
| --- | ------ |
| `a` | add a **keyword** highlight to the local watchlist (literal text; type it, `Enter`) |
| `r` | add a **regex** highlight to the local watchlist (e.g. `error \d{4}` or `powershell\.exe.*-enc`) |
| `x` | remove the most recently added local watchlist highlight |
| `i` | toggle case-insensitive matching for **all** rules (saved to `~/.config/loglens/config`) |
| `l` | show/hide the legend panel (also saved to the same config file) |

Click a highlight in the legend to jump to its next match; keep clicking to
step through every occurrence (the active rule shows a ▸ marker).

You can also preload highlights from the command line — see
[Command-line reference](#command-line-reference). At most **64** highlight
rules can be active; regex patterns are capped at **512** bytes and compiled
with size/nest budgets so a pathological pattern cannot hang the TUI.

---

## Watchlist workspace

Press W in the viewer or findings panel to open the local watchlist workspace.
It shows the user-controlled keyword and regex highlights in their exact
ordered form, including whether each entry is literal (keyword) or compiled as
a regex. The add action writes to this local collection after you press Enter.
The workspace does not change curated built-in diagnostic findings; those remain
immutable scan metadata owned by the versioned signature catalog.

| Key | Action |
| --- | ------ |
| j / k, up / down | select an entry |
| a | add a trimmed keyword highlight to the local watchlist |
| r | add a trimmed regex highlight to the local watchlist |
| x | remove the selected entry |
| s | save the complete list |
| R | reload the last valid file |
| q / Esc / W | close the workspace |

Every add, remove, save, and reload feeds the existing chunked highlight
rescan. Search/filter position is retained except when the normal rescan
rebuilds a filtered view around its current line. An empty, duplicate,
over-limit, or invalid entry reports an error and leaves the active list
unchanged. A malformed, unsupported, unreadable, or failed replacement on
reload likewise leaves both the active list and the last valid file alone.

The canonical file is watchlist.json beside the preferences file in the
resolved LogSift config directory:

- Linux/macOS: $XDG_CONFIG_HOME/loglens/watchlist.json, or
  ~/.config/loglens/watchlist.json
- Windows: %APPDATA%/loglens/watchlist.json
- Tests and special setups: set LOGLENS_CONFIG_DIR

Version 1 contains only an integer version and an ordered array of typed
entries. A saved file looks like this:

~~~
{
  "version": 1,
  "entries": [
    { "kind": "keyword", "value": "ERROR" },
    { "kind": "regex", "value": "timeout\\s+\\d+" }
  ]
}
~~~

Keywords are literal and regexes use the same size and nesting limits as
ordinary highlights. Values are trimmed before validation. Duplicate identity
is kind-aware; when ignore-case is enabled, comparison also ignores case. A
missing file is a normal first run: the TUI starts with no user highlights but
still scans the curated built-in signature library automatically. Built-in
findings never enter the persisted document. The local watchlist needs no AI,
network access, or uploaded logs; no candidate suggestions are generated.

Command-line -k and -r rules take precedence for that run and are not silently
overwritten by the saved file. Open the workspace and press s if you want to
replace the local watchlist with the active CLI rule set.

---

## Search & filter

| Key | Action |
| --- | ------ |
| `/` | search (case-insensitive, literal text). `Enter` jumps to the first hit; `n`/`N` walk results (wraps) |
| `f` | **filter mode** — collapse the view to only matching lines |
| `c` | clear search and filter together (one key) |
| `Esc` | clear search → clear filter → quit (peels one layer at a time) |

Filter mode is the biggest time-saver in the tool:

- With a search active, `f` shows **only lines matching the search**.
- With no search, `f` shows **only lines that hit one of your local watchlist highlights**.

Either way, original line numbers are preserved, so a 10,000-line log
becomes the 40 lines worth reading without losing your place. If `f` hides
the line you were on, the status bar says so and the cursor moves to the
nearest remaining match. Press `f` again, `c` (clears search and filter
together), or `Esc` once search is cleared to restore the full view.

Search matches render with a bright white highlight, layered on top of any
keyword colors.

---

## Settings

Press **`,`** to open the settings panel. It collects the preferences that
persist between sessions:

| Setting | Default | Also on |
| ------- | ------- | ------- |
| Ignore case in highlights | off | `i` |
| Show highlight legend | on | `l` |
| Scan on open | on | — |

`j`/`k` move, `Enter` or `Space` toggles the selected row, and `,`/`q`/`Esc`
closes. You can also click a row. Because a scan opens the findings panel on
its own, `,` works from inside that panel too — settings layers on top, and
`Esc` drops back to the findings list. Every change is written to
`~/.config/loglens/config` immediately — there is no separate save step, and
the status line confirms each write.

Rows that also have a keybinding show it beside the value, so opening the panel
once is how you stop needing to open it.

**Scan on open** is the one setting without a shortcut. Turning it off means
files open without being scanned, and `S` scans when you want it; turning it
back on affects files you open from then on, not the ones already loaded. The
`--no-scan` flag suppresses the launch scan for a single run without changing
what is saved, so you can open one large bundle quietly and still have
scan-on-open next time.

---

## Mouse reference

| Action | Result |
| ------ | ------ |
| Wheel over the log | scroll |
| Click a log line | move the cursor there |
| Click a file tab | switch to that file |
| Click the scrollbar track | jump to that position |
| Drag the scrollbar thumb | continuous scroll |
| Click a highlight in the legend | jump through that rule's matches |
| Click a row in the findings panel | jump to that finding's line |
| Click a row in the settings panel | toggle that setting |
| Click / wheel in the file browser | select entries |

Pasting into the terminal is safe: pasted text is only ever inserted into the
input prompt, never interpreted as keystrokes.

---

## Keybinding reference

Press `?` in the app for this list any time.

**Viewer** — `j`/`k` scroll · `←`/`→` pan · `0` reset pan ·
`Ctrl-d`/`Ctrl-u`/`Space`/`PgDn`/`PgUp` page · `g`/`G`/`Home`/`End`
top/bottom · `:` go to line · `m` bookmark · `M` clear bookmarks ·
`'`/`"` next/prev bookmark · `Enter` first match · `n`/`N` next/prev match
(wraps) · `Tab`/`]` next file · `Shift-Tab`/`[` prev file · `o` file browser ·
`w` close file · `y` copy cursor line · `Y` copy file path · `q` quit

**Scan** — `S` scan · `s` reopen findings · `p`/`P` next/prev finding (wraps) ·
`e` export markdown · in panel: `j`/`k` move, `Enter` jump, `e` export,
`,` settings, `?` help, `q`/`Esc` close

**Search & filter** — `/` search · `f` filter · `Enter` first match ·
`n`/`N` walk matches (wraps) · `c` clear search+filter · `Esc` clear search →
clear filter → quit

**Local watchlist** — `a` adds a keyword highlight · `r` adds a regex highlight ·
`x` removes the last entry · `i` case (persisted) · `l` legend

**Settings** — `,` open · in panel: `j`/`k` move, `Enter` or `Space` toggle,
`,`/`q`/`Esc` close

**File browser** — `Enter`/`l` open/enter · `h` parent · `Space` mark ·
`o` open marked · `O` open folder/zip · `.` hidden files · `q` close

---

## Command-line reference

```text
loglens [OPTIONS] [FILES]...
```

| Option | Meaning |
| ------ | ------- |
| `[FILES]...` | files, folders, or `.zip` archives to open (folders/zips recurse) |
| `-k, --keyword <KEYWORD>` | literal keyword highlight for this run; repeatable or comma-separated (`-k "timeout,rollback"`) |
| `-r, --regex <PATTERN>` | regex highlight for this run; repeatable |
| `-i, --ignore-case` | case-insensitive matching for all rules (this session; also OR'd with the saved `i` preference) |
| `--no-scan` | don't scan on open; press `S` when you want it |
| `--format <raw\|json\|csv>` | force non-interactive output with stable raw/JSON/CSV contracts |
| `--lens <id>` | select `general-triage` (default), `incident-reliability`, or `security-signals` |
| `--walkthrough` | replay the interactive walkthrough; machine modes stay non-interactive |
| `--stdin` | read stdin explicitly, even when it is a terminal |
| `--version` | print version |
| `--help` | print CLI help |

Preferences: the settings panel (`,`), and the `i` / `l` shortcuts, write
`ignore_case`, `show_legend` and `scan_on_open` (`true|false`) to
`~/.config/loglens/config` (or `$XDG_CONFIG_HOME/loglens/config` /
`%APPDATA%\loglens\config` on Windows). Navigating or leaving the file browser
(`o`) also writes `browser_cwd` so the next launch reopens there when the path
still exists. Override the directory with `LOGLENS_CONFIG_DIR`. The next launch
restores those settings; `-i` still forces ignore-case on for the session, and
`--no-scan` suppresses the launch scan for one run without changing the saved
`scan_on_open`. The walkthrough adds `walkthrough=skipped` or
`walkthrough=completed`; an absent key means `unseen`.

The local watchlist workspace stores its separate versioned document as
watchlist.json in that same directory. The file is written through a
same-directory temporary file and replacement, so a failed save does not
truncate the last valid watchlist.

Example — open a bundle with a standing rule set:

```sh
loglens -i -k ERROR -k WARN -k "access denied" \
        -r 'powershell\.exe.*-enc' \
        ./diagnostic-bundle/
```

---

## Limits & safety

loglens is built to open untrusted diagnostic bundles without exhausting
memory or disk. Caps that most often matter:

| Area | Cap | What happens |
| ---- | --- | ------------ |
| Single log file | **50 MiB** | Skipped in folder/zip collect; direct open rejected |
| Zip archive (compressed) | **256 MiB** | Archive refused before extraction |
| Zip extract / file | **64 MiB** | Oversized entry skipped |
| Zip extract / total | **512 MiB** | Further entries skipped |
| Zip entries scanned | **10,000** | Remainder ignored |
| Dir depth / files per resolve | **32** / **2,000** | Deeper or extra files skipped |
| Symlinks (auto-collect) | never followed | Avoids cycles and escape from the bundle |
| Zip extract directory | fresh, `0700` on Unix | Not reused, not world-readable; removed on exit |
| Lines / file · bytes / line | **250,000** · **32 KiB** | Extra lines dropped; long lines truncated with `…` |
| Open tabs · session lines | **500** · **1,000,000** | Further opens skipped (`open cap reached…`) |
| Highlight rules · regex source | **64** · **512 B** | Add rejected with a status message |
| Scan findings panel | **10,000** (Medium+) | Status shows `… findings (capped)`; gutter still updates |
| Bookmarks / open file | **64** | Toggle rejected with a status message |
| Clipboard yank payload | **~12 KiB** | Longer lines copied truncated (OSC-52) |
| Input prompt (incl. paste) | **4,096** characters | Extra input ignored |

When a file hits the line/length caps the open status notes it was
**truncated**. These numbers live next to the code that enforces them
(`src/ingest.rs`, `src/app.rs`, `src/rules.rs`, `src/clipboard.rs`) — change
the constant and the behavior together.

---

## Troubleshooting

**`command not found: cargo` (or `loglens`)**
Your shell predates the Rust install. Run `source "$HOME/.cargo/env"` or open
a new terminal.

**A file won't open / "no log files found"**
Folders and zips only auto-collect non-empty text-looking files under
50 MiB. Empty files and files whose first 8 KiB contain a NUL are treated as
binary and skipped. Symlinks are never followed during collection. Open a
specific file directly (`loglens path/to/file`) to bypass folder collection
(direct open still rejects files over 50 MiB).

**Status says `open cap reached` or `… truncated`**
You hit the session file/line budget (500 tabs / 1M lines) or a single file
exceeded 250k lines / 32 KiB per line. Close tabs with `w`, or open a smaller
subset of the bundle.

**`local watchlist limit reached` / regex rejected**
At most 64 local watchlist highlight rules; regex patterns max 512 bytes and must compile
under the size/nest budgets. Remove a rule with `x` and try a simpler pattern.

**Scan status shows `N+ findings (capped)`**
The findings panel stopped at 10k Medium+ hits. Gutter severity dots still
cover matched lines — jump via the legend/search, or filter with `f`.

**Log shows `�` characters**
The file contains non-UTF-8 bytes (common in real diagnostic logs). loglens
opens it anyway and replaces only the invalid bytes.

**Colors look wrong / washed out**
loglens uses 24-bit color. Use a truecolor-capable terminal (iTerm2, Windows
Terminal, most modern Linux terminals) and make sure `TERM` isn't forced to
an 8-color profile.

**Mouse clicks do nothing over SSH/tmux**
Ensure your terminal forwards mouse events (in tmux: `set -g mouse on`).

**The terminal is garbled after a crash**
loglens restores the terminal even on panics, but if a hard kill (`kill -9`)
leaves things broken, run `reset`.
