# Claude account switcher

[![ci](https://github.com/edunascimentt/claude-accounts/actions/workflows/ci.yml/badge.svg)](https://github.com/edunascimentt/claude-accounts/actions/workflows/ci.yml)

Run multiple Claude Code accounts from one terminal — a picker UI on `claude`,
plus add/remove any number of accounts. Each account is a fully isolated config
dir (own login, history, projects) via `CLAUDE_CONFIG_DIR`. Your default
`~/.claude` is never touched.

Works in **PowerShell** and **bash/zsh** — **Windows, macOS, Linux** (smoke-tested
on all three in CI). Needs **Node.js 16+** (the picker engine).

## Privacy & safety

- **Fully local.** No network calls, no telemetry — the engine only reads your
  local `~/.claude.json` to show which account is signed in.
- **Never touches credentials.** New accounts are seeded with copies of your
  *settings/skills/agents* only — never your login token (`.credentials.json`)
  or history. A new account is logged-out until you run `/login`.
- **Your default `~/.claude` is left alone.** Switching only sets
  `CLAUDE_CONFIG_DIR` for the launched process; your shell environment stays clean.
- The account registry stays on your machine (`~/.claude-accounts/profiles.json`)
  — it is **not** part of this repo.

Interactive picker — arrow keys move, manage accounts in place:

```
  ╭─────────────────────────────────────────────────────╮
  │  ✻ claude  accounts                                 │
  │                                                     │
  │ ❯ ● personal  you@gmail.com                         │
  │      Astro · Personal Org                           │
  │   ● work  you@company.com                           │
  │   ○ client  not logged in                           │
  │   + add account                                     │
  ╰─────────────────────────────────────────────────────╯
    ↑↓ move · ↵ select · r rename · d delete · a add · q quit
    edunascimentt.dev
```

`↑↓`/`j``k` move · `↵` launch the selected account · `r` rename · `d` delete ·
`a` (or the **+ add account** row) add. Renaming and adding type **inside the
box** — no separate prompt line. Delete asks `y / n` in the footer.

## Install

Needs **Node.js** (the whole thing runs on it). Pick whichever is easiest:

**A — straight from GitHub** (one command, any OS)
```bash
npx github:edunascimentt/claude-accounts
# or keep the manager command around:
npm install -g github:edunascimentt/claude-accounts
claude-accounts                # install + wire shells
```
(If published to npm, `npx claude-accounts` / `npm i -g claude-accounts` also work.)

**B — from the folder / a sent tarball** (no npm registry needed)
```bash
# someone sent you claude-accounts-1.0.0.tgz:
npm install -g ./claude-accounts-1.0.0.tgz && claude-accounts
# …or just run the script for your OS, from the unzipped folder:
node setup.js          # any OS
pwsh -File install.ps1 # Windows double-click-friendly
bash install.sh        # macOS / Linux / git-bash
```

All paths run the same `setup.js`: copies the engine to `~/.claude-accounts/`,
builds a registry (auto-detecting existing `~/.claude-<name>` dirs), and wires
your shell rc files — **idempotent**, safe to re-run, replaces older blocks.

Open a new terminal (or `. $PROFILE` / `source ~/.bashrc`).

### Manager commands
```
claude-accounts            install / re-wire
claude-accounts status     list installed accounts
claude-accounts uninstall  remove shell wiring (keeps your data)
```

## Build a package to send

```bash
cd tools/claude-accounts
npm pack          # -> claude-accounts-1.0.0.tgz  (≈10 kB, 9 files)
```
Send the `.tgz` (or zip the folder). Recipient runs install path **B**. That's it.

## Use

| command | does |
|---------|------|
| `claude` | open the interactive picker (↑↓ nav, in-box rename/add/delete) |
| `claude <args>` | passthrough to your default account (`claude -p …` etc. unchanged) |
| `claude-add [name]` | create a new isolated account from the shell, then log in |
| `claude-acct` | list all accounts + who's signed in |
| `claude-use <key>` | launch a specific account by key |
| `claude-rm <key> [-Purge/--purge]` | unregister (optionally delete its dir) |
| `claude-personal` / `cpers` | default account |
| `claude-work` / `cwork` | the `work` account |

The picker (`claude`) is the easy path — everything (switch / rename / delete /
add) lives in the UI. The `claude-*` commands stay for scripting / muscle memory.

The TUI engine reads keys in raw mode and draws on stderr; it prints only the
chosen account's config dir to stdout, which the shell uses to launch Claude.

## How it works

- Each account = a config dir. `personal` is the default `~/.claude`
  (`dir: "DEFAULT"`); others live at `~/.claude-<key>`.
- Launching sets `CLAUDE_CONFIG_DIR` for that one process only (your shell env
  stays clean), so cookies/login/history are fully separated.
- New accounts are seeded with copies of your `settings.json`, `skills/`,
  `agents/`, `CLAUDE.md`, statusline — **not** your login or history. Plugins
  are not copied (large); copy `~/.claude/plugins` in manually if you want them.
- Registry: `~/.claude-accounts/profiles.json`. Engine: `acctinfo.js` (Node) —
  the single source of truth both shells call.

On a fresh machine, first `claude` shows just their default account;
`claude-add` (or `a` in the picker) builds the rest. Requires Node.js.

## Files

| file | role |
|------|------|
| `acctinfo.js` | Node engine — interactive UI / render / registry / add / remove |
| `switcher.ps1` | PowerShell functions (thin) |
| `switcher.sh` | bash/zsh functions (thin) |
| `setup.js` | cross-platform installer / manager (`install` · `status` · `uninstall`) |
| `install.ps1` / `install.sh` | one-line launchers → `setup.js` |
| `package.json` | npm package (`bin: claude-accounts`, `npm pack`) |
| `LICENSE` | MIT |
