# Build the macOS client from upstream

Runbook for pulling the latest `stablyai/orca` changes into this fork
(`sjennings/orca`) and producing a local macOS build.

## Remotes

| Remote    | URL                          | Role                                  |
| --------- | ---------------------------- | ------------------------------------- |
| `origin`  | `https://github.com/sjennings/orca` | This fork (has its own commits) |
| `upstream` | `https://github.com/stablyai/orca.git` | Original project          |

Local `main` carries fork commits (Polytoken support, CI tweaks), so it is
**diverged** from `upstream/main` — a fast-forward pull is never possible.
The sync pattern is a merge commit (see `git log --merges` for precedent).

## 1. Pull latest from upstream

```bash
git fetch upstream --prune
git merge upstream/main -m "Merge upstream/main into fork (v<version>)"
```

- Get the version for the message from `package.json` (`version` field).
- `git pull` alone is **not** enough — it pulls `origin`, not `upstream`.

### Known conflict: `src/main/agent-hooks/server/server-ingest-remote.ts`

The fork renamed `isValidPiProviderSessionOnly` → `isValidProviderSessionOnly`
(Polytoken commit `4a156ec657`); upstream still uses the old name and keeps
adding ingest-class layers. When it conflicts, keep **both** intents:

```ts
import { isValidProviderSessionOnly } from './server-status-identity'   // fork rename
import { AgentHookServerIngestStructured } from './server-ingest-structured' // upstream layer
```

After resolving, check `grep -rn isValidPiProviderSessionOnly src/` returns
nothing, and that the class declaration matches the imported base class.

## 2. Reinstall dependencies

The merge usually churns `pnpm-lock.yaml`; pnpm may prompt to reinstall
`node_modules` from scratch (auto-accepts `Y` in non-interactive shells).

```bash
pnpm install
```

## 3. Node version

`package.json` engines pin `"node": "24"`. This machine manages Node with
`mise` (24.21.0 and 26.3.0 installed). Prefix commands so the build runs on 24:

```bash
mise exec node@24.21.0 -- pnpm install
mise exec node@24.21.0 -- pnpm run build:mac
```

Node 22 only prints an engine warning, but native builds and lockfile state
are happier when the version matches the pin; switching node versions makes
pnpm want a full `node_modules` reinstall again — let it.

## 4. Build

Local build — the default for a personal client:

```bash
mise exec node@24.21.0 -- pnpm run build:mac
```

What it does:

1. `build:desktop` — typecheck, relay, CLI, electron-vite bundle, web renderer
2. `build:computer-macos`, `build:keyboard-layout-macos`,
   `build:notification-status-macos` — native macOS helpers (needs Xcode CLT)
3. `ensure:electron-runtime` — downloads the pinned Electron runtime if missing
4. `electron-builder --mac` via `config/scripts/build-mac-local.mjs`, which
   stamps a version like `1.4.197-local.<timestamp>.<short-commit>`

Signing: local builds **are signed** with the Developer ID certificate
("Developer ID Application: Scott Jennings (ZRZZE3JYWQ)") if it's on the
keychain; notarization is explicitly disabled (`notarize: false`), so first
launch on another machine still needs a right-click → Open/Gatekeeper bypass.

Release build (signed + notarized) instead uses `pnpm run build:mac:release`
and runs `verify-macos-release-env.mjs` first — it **fails** if signing or
notarization credentials are unavailable.

Runtime on this machine (M-series, ~14 min total): both `x64` and `arm64`
slices are built; x64 cross-arch slice skips the boot verification steps
with "skipped on cross-arch slice", which is expected, not a failure.

## 5. Artifacts

Output lands in `dist/` (stamped zips accumulate there across builds — old
ones are safe to delete):

- `orca-macos-x64.dmg`, `orca-macos-arm64.dmg` — installers (overwritten each build)
- `Orca-<version>-local.<timestamp>.<commit>-mac.zip` (x64) and
  `...-arm64-mac.zip` — per-build zips
- `dist/mac/Orca.app`, `dist/mac-arm64/Orca.app` — unpacked apps

## 5. Fork release CI (all platforms, unsigned)

To publish installable builds for every desktop platform to this fork's
Releases page, dispatch the fork release workflow instead of building locally:

```bash
gh workflow run fork-client-release.yml --ref main
```

It builds macOS (dmg/zip, x64 + arm64), Windows (setup exe), and Linux
(AppImage/deb/rpm, x64 + arm64) in parallel, uploads them to a draft release,
verifies the updater manifests, then publishes. All artifacts are unsigned —
per-platform caveats are in the workflow header. Packaged builds check this
repo's releases for updates (`ORCA_PUBLISH_OWNER`/`ORCA_PUBLISH_REPO` in
`config/electron-builder.config.cjs`), never upstream's.

## Troubleshooting

- **Merge conflicts beyond the ingest file** — inspect both sides with
  `git log --oneline -3 HEAD -- <file>` and
  `git log --oneline -3 upstream/main -- <file>` before picking.
- **Typecheck failures after merge** — `build:desktop` typechecks first, so a
  failed build early in the sequence is usually a half-resolved merge, not a
  packaging problem. `pnpm tc` isolates it.
- **Stale Electron runtime errors** — `ensure:electron-runtime` runs inside
  `build:mac`; if it fails standalone, check disk space and rerun
  `pnpm run rebuild:electron`.
