# Codex Multi-Account

Shareable multi-account launchers for `codex` CLI and `Codex.app` on macOS.

This repository packages the local workflow that was validated end-to-end:

- `codex` CLI launches with isolated `CODEX_HOME` directories per account
- `Codex.app` launches as cloned app bundles with isolated:
  - `CODEX_HOME`
  - Electron `userData`
  - bundle identifiers
- desktop clones are patched so multiple app instances can stay open at once
- optional custom icons can be installed per account

## What It Solves

Codex already supports `CODEX_HOME`, which is enough to isolate CLI login state. The desktop app needs more work:

- separate app bundle clones
- separate Electron `userData`
- runtime app name / Dock badge overrides
- a bypass for Electron's single-instance lock
- a fresh `ElectronAsarIntegrity` hash after patching `app.asar`

This tool automates those steps.

## Requirements

- macOS
- `python3`
- `node`
- `codesign`
- For custom PNG icons:
  - `sips`
  - `iconutil`

The desktop app flow is macOS-specific. The CLI flow is simpler and mostly relies on `CODEX_HOME`.

## Quick Start

Install both CLI and desktop launchers for two accounts:

```bash
./bin/codex-multi-account install personal
./bin/codex-multi-account install work
```

Then launch them with:

```bash
codex-personal
codex-work
codex-app-personal
codex-app-work
```

## Install An Account

If you want both CLI and desktop launchers:

```bash
./bin/codex-multi-account install personal
./bin/codex-multi-account install work
```

This writes:

- `~/.local/bin/codex-account-home`
- `~/.local/bin/codex-personal`
- `~/.local/bin/codex-work`
- `~/.local/bin/codex-app-personal`
- `~/.local/bin/codex-app-work`
- `~/Applications/Codex Personal.app`
- `~/Applications/Codex Work.app`

CLI-only:

```bash
./bin/codex-multi-account install lab --cli
```

Desktop-only:

```bash
./bin/codex-multi-account install lab --app
```

## Custom App Icons

Use a PNG or ICNS for the cloned desktop app:

```bash
./bin/codex-multi-account install personal \
  --app \
  --force \
  --icon-png ~/Downloads/exports/codex-pp_05_bracketed_1024.png
```

If the Dock keeps an old icon cached, remove the cloned app from the Dock and pin it again once.

## Generated Launchers

After installation:

```bash
codex-personal
codex-work
codex-app-personal
codex-app-work
```

The CLI launchers isolate:

- `~/.codex-personal`
- `~/.codex-work`

The desktop launchers isolate both:

- `~/.codex-<account>`
- `~/Library/Application Support/Codex-<Account>`

## Why The Desktop App Needs Patching

`CODEX_HOME` is enough for CLI account isolation, but the desktop app also keeps state in Electron-managed app data and ships with a single-instance lock. To make `Codex Personal.app` and `Codex Work.app` coexist cleanly, this tool:

- clones the upstream app bundle
- patches the Electron bootstrap
- sets per-account `CODEX_ELECTRON_USER_DATA_PATH`
- enables per-clone app labels and Dock badges
- recomputes `ElectronAsarIntegrity`
- re-signs the cloned bundle locally

## How It Works

### CLI

The generated `codex-account-home` helper:

- creates `~/.codex-<account>`
- symlinks low-churn shared assets from `~/.codex`
  - `config.toml`
  - `plugins`
  - `skills`
  - `mcp-servers`
  - other static support directories
- exports `CODEX_HOME`

### Desktop App

For each account:

1. Clone `/Applications/Codex.app` into `~/Applications/Codex <Account>.app`
2. Extract `Contents/Resources/app.asar`
3. Patch Electron bootstrap so the clone can:
   - read `CODEX_ELECTRON_APP_NAME`
   - read `CODEX_ELECTRON_DOCK_BADGE`
   - skip the single-instance lock when `CODEX_ELECTRON_ALLOW_MULTI_INSTANCE=1`
4. Repack `app.asar`
5. Recompute the ASAR header hash used by `ElectronAsarIntegrity`
6. Update `Info.plist`
7. Re-sign the app locally with ad-hoc signing

## Limitations

- Tested against the current Codex desktop bundle layout used in `26.415.x`
- The desktop patch assumes the upstream app still keeps its bootstrap logic in `.vite/build/bootstrap.js`
- When OpenAI ships a major desktop-app packaging change, rerun validation before trusting the patcher
- Desktop clones are re-signed locally, so macOS may require a one-time manual open
- The helper scripts embed launch paths under `~/.local/bin` and `~/Applications`

## Validation Status

This repository was smoke-tested against a real local Codex installation:

- CLI wrappers correctly isolated `CODEX_HOME`
- desktop clones launched from separate `.app` bundles
- Electron helper processes used separate `--user-data-dir` paths
- per-clone bundle identifiers and launcher paths resolved correctly

## Repository Layout

- `bin/codex-multi-account`
  - main installer
- `lib/extract_asar.mjs`
  - extract an ASAR archive without external npm install
- `lib/pack_asar.mjs`
  - repack an ASAR archive
- `lib/hash_asar_header.mjs`
  - compute the header hash required by `ElectronAsarIntegrity`
- `lib/asar_vendor`
  - vendored subset of `@electron/asar` under MIT license

See [NOTICE.md](NOTICE.md) for third-party vendored code details.

## GitHub Sharing Notes

This directory is already repo-ready. A typical publish flow is:

```bash
cd codex-multi-account
git init -b main
git add .
git commit -m "Initial release"
```

Then create a GitHub repo and push it:

```bash
git remote add origin git@github.com:<you>/codex-multi-account.git
git push -u origin main
```
