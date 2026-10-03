# loglens signature library — v0.1.0

A versioned, **shared**, curated data contract for detection sets. The current
Rust loglens binary ships its built-in diagnostic signatures in Rust; these
JSON manifests remain available for the web catalog and future consumers.

The library is **data, not code**: every entry is a hand-authored JSON manifest
under `signatures/<version>/`. The Polsia app ships a zod validator + pure
loader in `src/lib/contracts/signatures.ts`; the Rust CLI re-implements the
same shape in its own loader, so the contract stays a tool-agnostic crib its
maintainers mirror in a 1:1 implementation.

---

## Format

A manifest is a single JSON object:

```jsonc
{
  "version": "v0.1.0",          // SemVer-like literal in this format: vMAJOR.MINOR.PATCH
  "set": "kebab-id",            // kebab-case 1-63 chars, lowercase a-z, digits and dashes
  "title": "human readable title",
  "description": "what this set catches",
  "patterns": [
    {
      "name": "5xx response",
      "id": "nginx-5xx-response",
      "severity": "warning",     // critical | warning | notice | debug
      "explanation": "what this line means in plain English",
      "severityRationale": "why this tier is appropriate",
      "falsePositiveNote": "the most important benign interpretation",
      "examples": {
        "positive": "representative matching line",
        "negative": "representative non-matching or near-miss line"
      },
      "match": { "regex": "\\b5[0-9]{2}\\b" }
    }
    // ... more patterns ...
  ],
  "notes": "optional human prose"
}
```

Per-rule rules:
- `id` — immutable lower-kebab machine identity. It must not be derived from a
  mutable title or catalog version.
- `explanation`, `severityRationale`, and `falsePositiveNote` — required audit
  metadata for shipped patterns. `examples.positive` and `examples.negative`
  are required regression fixtures. A complete quality block is what makes a
  manifest entry trusted built-in evidence.
- `version` — literal `vMAJOR.MINOR.PATCH`, three numeric components, no
  suffix, no prerelease. `v0.1.0` is the only version currently published;
  the loader will reject any other shape, but it does NOT maintain a
  registry of "known" versions — loaders are free to accept any future
  version they support. The schema's regex is the only enforced bit.
- `set` — 1-63 chars, lowercase ASCII a-z, digits, and `-`. Must start with a
  lowercase letter. `_`, capitals, whitespace, and leading digits/dashes are
  rejected.
- `patterns[].severity` — one of four closed tiers:
  - `critical` (highest catalog rank; consumers decide how to act on it)
  - `warning` (rank 1)
  - `notice` (rank 2)
  - `debug` (rank 3)
- `patterns[].match` — either `{ "string": "...", "flags": "..." }` for a
  literal match, or `{ "regex": "...", "flags": "..." }` for a regex match.
  Both fields are exclusive: at most one of `string` / `regex` is present.
  `flags` is a closed set in v0.1.0: `""` (case-sensitive) or `"i"`
  (case-IN-sensitive, the default for both string- and regex-based
  matches). The default is `i` for case-insensitive catalog matching.

`multi`-line / `continuation` matching is **out of scope** for the signature
library. The `multi` and `continuation` fields live on watchlists (per-call,
operator-tuned) and not on signatures (curated, versioned). v0.2.0 may
add `multi` patterns to the loader, but that is not part of v0.1.0.

---

## Adding a pattern to an existing set

1. Edit the JSON in place under `signatures/v0.1.0/<existing-set>.json`.
2. Decide the right severity first. When in doubt, use `warning`.
3. Pick the right shape:
   - **string** when the literal substring is exact (case-IN-sensitive
     search). Use `flags: ""` if you genuinely need case-sensitive matching.
   - **regex** when the line is variable. ECMAScript semantics, anchored at
     neither end (`^`/`$` only added by the author).
4. Run `npm run test -- tests/unit/signatures` to make sure the change
   re-passes the schema contract; if you added a brand-new pattern, add a
   matching test in `manifest-loader.test.ts`.
5. Submit a PR. The `version` field stays `v0.1.0` — adding patterns is a
   non-breaking patch addition.

## Adding a NEW set inside v0.1.0

1. Write a new `<your-set>.json` under `signatures/v0.1.0/`.
2. Copy `schema.json` (a crib, NOT consumed by code) as a starting point;
   rename `set` to your kebab id, drop its `severity`/`match` arrays from
   the example, and list your `patterns`.
3. Patterns must cover **at least one critical** and one non-critical tier.
4. Bump `version` on adjacent manifests only if you need to republish the
   catalog with new ground rules (rare). Most sets remain at `v0.1.0`
   independent of each other.
5. Run `npm run test -- tests/unit/signatures` and confirm both
   `manifest-schema.test.ts` (contract) and `manifest-loader.test.ts`
   (compiled matchers) pass.

## Releasing a NEW version (v0.2.0)

When the contract itself changes (added severity tier, added `flags` letter,
new `match` shape, new at-version policies), we ship a new version directory:

1. Duplicate `signatures/v0.1.0/` -> `signatures/v0.2.0/`.
2. Update `Signatures/<file>.json`'s `version` field on each file to
   `v0.2.0`.
3. Add a `CHANGELOG.md` to `signatures/v0.2.0/` describing the breaking
   differences from v0.1.0.
4. Update `src/lib/contracts/signatures.ts`'s `SemVerV` regex *only* if the
   version-string shape itself changes (otherwise the `vMAJOR.MINOR.PATCH`
   regex is generic enough).
5. Update the contract's prose (`this README`, the zod seatbelt) so v0.2.0
   is consistent.
6. **Do not delete `v0.1.0/`.** The loader keeps both available; the Rust
   CLI should be able to keep emitting v0.1.0 picks for users that have not
   yet upgraded.

## Versioning policy

SemVer, applied to the data shape (not the JSON content):
- **MAJOR** — the contract changes in a breaking way. New severity tiers,
  dropped fields, regex semantics change.
- **MINOR** — purely additive. New pattern shapes are accepted; old shapes
  still parse the same. Adding patterns to existing sets is also a MINOR
  bump on the manifest's `version` field only if the set's data is
  freshly rewritten (otherwise patch).
- **PATCH** — typo and grammar fixes. No shape change.

## Tool-agnostic rule

The signature library is **JSON only**: no TS imports, no Rust imports, no
Rust ↔ Node processes. The only TS-shaped consumer in this repo is the
contract + loader at `src/lib/contracts/signatures.ts`, and even there the
loader is pure (no `fs`) so a Rust loader can catch up to bridge the same
contract surface 1:1. New manifests must not reference prerelease Node
APIs, and the loader must not introduce side effects.

---

## Seeded v0.1.0 sets

| File                                  | Purpose                                                |
|---------------------------------------|--------------------------------------------------------|
| `nginx-access-errors.json`            | access/error 5xx, upstream timeouts, permission denied |
| `postgres-timeouts.json`              | statement timeouts, FATAL, deadlock, lock waits        |
| `docker-container-crashes.json`       | exit codes, OOM, OCI runtime failures, panic traces    |
| `schema.json`                         | format crib for human readers; do not load             |
