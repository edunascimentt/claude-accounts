#!/usr/bin/env node
// Claude account switcher — engine. Single source of truth for both shells.
//   render <reg>                  -> draw the picker box
//   list   <reg>                  -> launch-dir per profile, one per line (1-based menu)
//   dir    <reg> <key>            -> launch-dir for one profile
//   status <reg>                  -> pretty account list (for `claude-acct`)
//   add    <reg> <name> <home>    -> create+seed+register a profile, print its config dir
//   remove <reg> <key>            -> unregister a profile, print the removed dir (kept on disk)
// A "launch dir" is either "DEFAULT" (no CLAUDE_CONFIG_DIR -> ~/.claude) or an absolute path.
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const OR = '\x1b[38;2;217;119;87m', DM = '\x1b[38;2;138;138;138m',
      GR = '\x1b[38;2;126;186;120m', WT = '\x1b[97m', FT = '\x1b[38;2;82;80;76m',
      RS = '\x1b[0m';
const IN = 51;

const width = s => [...s].length;
const trunc = (s, w) => width(s) <= w ? s : [...s].slice(0, Math.max(0, w - 1)).join('') + '…';
const slugify = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function readReg(p) {
  try { const r = JSON.parse(fs.readFileSync(p, 'utf8')); if (Array.isArray(r.profiles)) return r; } catch (_) {}
  return { profiles: [{ key: 'personal', label: 'personal', dir: 'DEFAULT' }] };
}
function writeReg(p, reg) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(reg, null, 2)); }
function jsonPath(pr) { return pr.dir === 'DEFAULT' ? path.join(HOME, '.claude.json') : path.join(pr.dir, '.claude.json'); }
function account(pr) { try { return JSON.parse(fs.readFileSync(jsonPath(pr), 'utf8')).oauthAccount || {}; } catch (_) { return {}; } }

function infoOf(pr) {
  const a = account(pr);
  return {
    key: pr.key, label: pr.label || pr.key, dir: pr.dir,
    loggedIn: !!a.emailAddress, email: a.emailAddress || '',
    name: a.displayName || '', org: a.organizationName || '',
    plan: a.seatTier || a.userRateLimitTier || ''
  };
}

function render(profiles) {
  const rows = [];
  const add = (p, c) => rows.push({ p, c });
  add(' ✻ claude', ` ${OR}✻${RS} ${WT}claude${RS}`);
  add('', '');
  add(' Select an account', ` ${DM}Select an account${RS}`);
  add('', '');
  profiles.forEach((pr, n) => {
    const i = infoOf(pr);
    const dot = i.loggedIn ? '●' : '○';
    const dc = i.loggedIn ? GR : DM;
    const label = trunc(i.label, IN - 6);
    add(` ${n + 1}. ${dot} ${label}`, ` ${OR}${n + 1}.${RS} ${dc}${dot}${RS} ${WT}${label}${RS}`);
    if (i.loggedIn) {
      const em = trunc(i.email, IN - 4);
      add(`    ${em}`, `    ${DM}${em}${RS}`);
      const meta = [i.name, i.org, i.plan].filter(Boolean).join(' · ');
      if (meta) { const mt = trunc(meta, IN - 4); add(`    ${mt}`, `    ${DM}${mt}${RS}`); }
    } else {
      add('    not logged in — /login on launch', `    ${DM}not logged in — /login on launch${RS}`);
    }
    add('', '');
  });
  add(' a. + add account', ` ${OR}a.${RS} ${DM}+ add account${RS}`);

  const bar = '─'.repeat(IN + 2);
  const L = [''];
  L.push(`  ${OR}╭${bar}╮${RS}`);
  for (const r of rows) {
    const pad = Math.max(0, IN - width(r.p));
    L.push(`  ${OR}│${RS} ${r.c}${' '.repeat(pad)} ${OR}│${RS}`);
  }
  L.push(`  ${OR}╰${bar}╯${RS}`);
  L.push(`    ${DM}1-${profiles.length} select · a add · q quit${RS}`);
  L.push(`    ${FT}edunascimentt.dev${RS}`);
  L.push('');
  process.stdout.write(L.join('\n') + '\n');
}

function status(profiles) {
  const L = [''];
  profiles.forEach((pr, n) => {
    const i = infoOf(pr);
    const dot = i.loggedIn ? `${GR}●${RS}` : `${DM}○${RS}`;
    const email = i.loggedIn ? i.email : `${DM}(not logged in)${RS}`;
    L.push(`  ${dot} ${WT}${i.label.padEnd(12)}${RS} ${email.padEnd(34)} ${FT}${i.dir}${RS}`);
  });
  L.push('');
  process.stdout.write(L.join('\n') + '\n');
}

function seed(src, dst) {
  if (!fs.existsSync(src)) return;
  for (const f of ['settings.json', 'settings.local.json', 'CLAUDE.md', 'statusline-command.ps1', 'statusline-command.sh']) {
    try { if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(dst, f)); } catch (_) {}
  }
  for (const d of ['skills', 'agents']) {
    try { if (fs.existsSync(path.join(src, d))) fs.cpSync(path.join(src, d), path.join(dst, d), { recursive: true }); } catch (_) {}
  }
}

// pure: create+seed+register, return the new config dir (no printing)
function createProfile(regPath, name, home) {
  const reg = readReg(regPath);
  const slug = slugify(name) || 'acct';
  const keys = new Set(reg.profiles.map(p => p.key));
  let key = slug, dir = path.join(home, '.claude-' + key), n = 2;
  while (keys.has(key) || fs.existsSync(dir)) { key = `${slug}-${n}`; dir = path.join(home, '.claude-' + key); n++; }
  fs.mkdirSync(dir, { recursive: true });
  seed(path.join(home, '.claude'), dir);
  reg.profiles.push({ key, label: name || key, dir });
  writeReg(regPath, reg);
  return dir;
}
// pure: unregister, return removed dir ('' if refused/unknown)
function removeProfile(regPath, key) {
  const reg = readReg(regPath);
  const pr = reg.profiles.find(p => p.key === key);
  if (!pr || pr.dir === 'DEFAULT') return '';
  reg.profiles = reg.profiles.filter(p => p.key !== key);
  writeReg(regPath, reg);
  return pr.dir;
}
function renameProfile(regPath, key, label) {
  const reg = readReg(regPath);
  const pr = reg.profiles.find(p => p.key === key);
  if (pr) { pr.label = label; writeReg(regPath, reg); }
}

// ─────────────────────── interactive TUI ───────────────────────
// Arrow-key navigation + in-box editing. Draws on stderr; prints the chosen
// launch dir to stdout on select (empty = cancelled). Shell reads stdout.
function uiMain(regPath) {
  if (!process.stdin.isTTY) { process.exit(0); }
  const OFF = '\x1b[38;2;236;231;221m', RED = '\x1b[38;2;224;88;75m';
  const W = (s) => [...s].length;
  let reg = readReg(regPath);
  const state = { sel: 0, mode: 'list', buffer: '', msg: '' };
  let lastLines = 0;
  const err = (s) => process.stderr.write(s);

  function buildRows() {
    const list = reg.profiles.map(infoOf);
    const rows = []; const add = (p, c) => rows.push({ p, c });
    add(' ✻ claude  accounts', ` ${OR}✻${RS} ${WT}claude${RS}  ${DM}accounts${RS}`);
    add('', '');
    list.forEach((pr, i) => {
      const sel = state.sel === i;
      const ptrP = sel ? '❯ ' : '  ', ptrC = sel ? `${OR}❯${RS} ` : '  ';
      const dotP = pr.loggedIn ? '●' : '○', dotC = pr.loggedIn ? `${GR}●${RS}` : `${DM}○${RS}`;
      if (state.mode === 'rename' && sel) {
        const b = state.buffer;
        add(`${ptrP}${dotP} ${b} `, `${ptrC}${dotC} ${OFF}${b}${RS}${WT}▌${RS}`);
      } else {
        const label = trunc(pr.label, 18);
        const email = pr.loggedIn ? trunc(pr.email, IN - 27) : 'not logged in';
        const nc = (state.mode === 'delete' && sel) ? RED : (sel ? WT : OFF);
        add(`${ptrP}${dotP} ${label}  ${email}`, `${ptrC}${dotC} ${nc}${label}${RS}  ${DM}${email}${RS}`);
        if (sel && state.mode === 'list' && pr.loggedIn) {
          const meta = trunc([pr.name, pr.org, pr.plan].filter(Boolean).join(' · '), IN - 6);
          if (meta) add(`     ${meta}`, `     ${DM}${meta}${RS}`);
        }
      }
    });
    const sel = state.sel === list.length;
    const ptrP = sel ? '❯ ' : '  ', ptrC = sel ? `${OR}❯${RS} ` : '  ';
    if (state.mode === 'add' && sel) {
      const b = state.buffer;
      add(`${ptrP}+ ${b} `, `${ptrC}${OR}+${RS} ${OFF}${b}${RS}${WT}▌${RS}`);
    } else {
      add(`${ptrP}+ add account`, `${ptrC}${OR}+${RS} ${sel ? OFF : DM}add account${RS}`);
    }
    return rows;
  }

  function frame() {
    const rows = buildRows();
    const bar = '─'.repeat(IN + 2);
    const out = ['', `  ${OR}╭${bar}╮${RS}`];
    for (const r of rows) { const pad = Math.max(0, IN - W(r.p)); out.push(`  ${OR}│${RS} ${r.c}${' '.repeat(pad)} ${OR}│${RS}`); }
    out.push(`  ${OR}╰${bar}╯${RS}`);
    let hint;
    if (state.mode === 'list') hint = `${DM}↑↓ move · ↵ select · r rename · d delete · a add · q quit${RS}`;
    else if (state.mode === 'delete') { const nm = (reg.profiles[state.sel] || {}).label || ''; hint = `${RED}remove "${nm}"?${RS} ${DM}y / n${RS}`; }
    else hint = `${DM}↵ save · esc cancel${RS}`;
    out.push(`    ${hint}`);
    if (state.msg) out.push(`    ${DM}${state.msg}${RS}`);
    out.push(`    ${FT}edunascimentt.dev${RS}`);
    let s = '';
    if (lastLines > 0) s += `\x1b[${lastLines}A`;
    s += '\x1b[0J' + out.join('\n') + '\n';
    err(s);
    lastLines = out.length;
  }

  function erase() { if (lastLines > 0) err(`\x1b[${lastLines}A\x1b[0J`); }
  function teardown() { try { process.stdin.setRawMode(false); } catch (_) {} process.stdin.pause(); err('\x1b[?25h'); }
  function quit() { erase(); teardown(); process.exit(0); }
  function launch(pr) { erase(); teardown(); process.stdout.write(pr.dir); process.exit(0); }

  function onKey(key) {
    state.msg = '';
    if (key === '\x03') return quit();               // ctrl-c
    const list = reg.profiles.map(infoOf);
    if (state.mode === 'list') {
      if (key === '\x1b[A' || key === 'k') state.sel = Math.max(0, state.sel - 1);
      else if (key === '\x1b[B' || key === 'j') state.sel = Math.min(list.length, state.sel + 1);
      else if (key === '\r' || key === '\n') { if (state.sel < list.length) return launch(list[state.sel]); state.mode = 'add'; state.buffer = ''; }
      else if (key === 'r') { if (state.sel < list.length) { state.mode = 'rename'; state.buffer = reg.profiles[state.sel].label; } }
      else if (key === 'd') { if (state.sel < list.length) { if (reg.profiles[state.sel].dir === 'DEFAULT') state.msg = 'default account can’t be removed'; else state.mode = 'delete'; } }
      else if (key === 'a') { state.mode = 'add'; state.buffer = ''; state.sel = list.length; }
      else if (key === 'q' || key === '\x1b') return quit();
    } else if (state.mode === 'delete') {
      if (key === 'y' || key === 'Y') { removeProfile(regPath, reg.profiles[state.sel].key); reg = readReg(regPath); state.sel = Math.min(state.sel, reg.profiles.length); }
      state.mode = 'list';
    } else { // rename | add  (typing inside the box)
      if (key === '\r' || key === '\n') {
        const val = state.buffer.trim();
        if (state.mode === 'rename') { if (val) renameProfile(regPath, reg.profiles[state.sel].key, val); }
        else if (val) { const dir = createProfile(regPath, val, HOME); reg = readReg(regPath); const idx = reg.profiles.findIndex(p => p.dir === dir); if (idx >= 0) state.sel = idx; }
        if (state.mode === 'rename') reg = readReg(regPath);
        state.mode = 'list';
      } else if (key === '\x1b') state.mode = 'list';
      else if (key === '\x7f' || key === '\b') state.buffer = state.buffer.slice(0, -1);
      else if (!key.startsWith('\x1b') && key >= ' ') state.buffer += key;
    }
    frame();
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  err('\x1b[?25l');
  frame();
  process.stdin.on('data', onKey);
}

const [cmd, a1, a2, a3] = process.argv.slice(2);
switch (cmd) {
  case 'render': render(readReg(a1).profiles); break;
  case 'list':   process.stdout.write(readReg(a1).profiles.map(p => p.dir).join('\n')); break;
  case 'dir': { const p = readReg(a1).profiles.find(x => x.key === a2); process.stdout.write(p ? p.dir : ''); break; }
  case 'status': status(readReg(a1).profiles); break;
  case 'add':    process.stdout.write(createProfile(a1, a2, a3 || HOME)); break;
  case 'remove': process.stdout.write(removeProfile(a1, a2)); break;
  case 'ui':     uiMain(a1); break;
  default: process.stderr.write('unknown command\n'); process.exit(1);
}
