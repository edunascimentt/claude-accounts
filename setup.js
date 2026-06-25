#!/usr/bin/env node
// claude-accounts — cross-platform installer / manager.
//   claude-accounts            (or `install`)  install + wire shells
//   claude-accounts uninstall                  remove shell wiring (keeps your data)
//   claude-accounts status                     show installed accounts
// Wired by npm `bin`, by install.ps1/install.sh, or run directly with node.
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const HOME = os.homedir();
const SRC = __dirname;
const DST = path.join(HOME, '.claude-accounts');

const OR = '\x1b[38;2;217;119;87m', DIM = '\x1b[38;2;138;138;138m', OFF = '\x1b[97m',
      GR = '\x1b[38;2;126;186;120m', FT = '\x1b[38;2;82;80;76m', YEL = '\x1b[38;2;224;179;65m', RS = '\x1b[0m';

const ENGINE = ['acctinfo.js', 'switcher.ps1', 'switcher.sh'];

function banner() {
  console.log('');
  console.log(`  ${OR}✻${RS} ${OFF}claude-accounts${RS}`);
  console.log(`  ${DIM}multiple Claude Code accounts, one terminal${RS}   ${FT}edunascimentt.dev${RS}`);
  console.log('');
}

function copyEngine() {
  fs.mkdirSync(DST, { recursive: true });
  for (const f of ENGINE) fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
}

function buildRegistry() {
  const reg = path.join(DST, 'profiles.json');
  if (fs.existsSync(reg)) return { created: false, reg };
  const profiles = [{ key: 'personal', label: 'personal', dir: 'DEFAULT' }];
  for (const n of fs.readdirSync(HOME)) {
    if (n.startsWith('.claude-') && n !== '.claude-accounts') {
      const dir = path.join(HOME, n);
      try { if (fs.statSync(dir).isDirectory()) profiles.push({ key: n.slice(8), label: n.slice(8), dir }); } catch (_) {}
    }
  }
  fs.writeFileSync(reg, JSON.stringify({ profiles }, null, 2));
  return { created: true, reg, count: profiles.length, keys: profiles.map(p => p.key) };
}

function stripBlocks(txt) {
  return txt
    .replace(/# ===== Claude account switcher[\s\S]*?# ===== end account switcher =====\r?\n?/g, '')
    .replace(/# ===== ArcOS :: Claude[\s\S]*?# ===== end ArcOS Claude switcher =====\r?\n?/g, '');
}

function patchRc(file, sourceLine) {
  let txt = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  txt = stripBlocks(txt).replace(/\s+$/, '');
  const block = `# ===== Claude account switcher (edunascimentt.dev) =====\n${sourceLine}\n# ===== end account switcher =====\n`;
  txt = (txt ? txt + '\n\n' : '') + block;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, txt);
  return file;
}

function psProfilePath() {
  for (const sh of ['pwsh', 'powershell']) {
    try {
      const p = cp.execSync(`${sh} -NoProfile -Command "$PROFILE"`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (p) return p;
    } catch (_) {}
  }
  return path.join(HOME, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
}

function ensureBashProfile() {
  const bp = path.join(HOME, '.bash_profile');
  let txt = fs.existsSync(bp) ? fs.readFileSync(bp, 'utf8') : '';
  if (!/bashrc/.test(txt)) {
    txt += (txt ? '\n' : '') + '\n[ -f ~/.bashrc ] && . ~/.bashrc\n';
    fs.writeFileSync(bp, txt);
  }
}

function install() {
  banner();
  copyEngine();
  console.log(`  ${GR}✓${RS} engine installed  ${FT}${DST}${RS}`);

  const r = buildRegistry();
  if (r.created) console.log(`  ${GR}✓${RS} registry created  ${DIM}${r.count} account${r.count > 1 ? 's' : ''}: ${r.keys.join(', ')}${RS}`);
  else console.log(`  ${DIM}·${RS} registry kept     ${FT}${r.reg}${RS}`);

  const bashLine = '[ -f "$HOME/.claude-accounts/switcher.sh" ] && source "$HOME/.claude-accounts/switcher.sh"';
  const patched = [patchRc(path.join(HOME, '.bashrc'), bashLine)];
  ensureBashProfile();
  // zsh is the macOS default shell — wire .zshrc when zsh is in use (create if missing)
  const shell = process.env.SHELL || '';
  if (/zsh/.test(shell) || process.platform === 'darwin') patched.push(patchRc(path.join(HOME, '.zshrc'), bashLine));
  if (process.platform === 'win32') patched.push(patchRc(psProfilePath(), '. "$HOME\\.claude-accounts\\switcher.ps1"'));
  for (const f of patched) console.log(`  ${GR}✓${RS} shell wired       ${FT}${f}${RS}`);

  console.log('');
  console.log(`  ${OFF}Done.${RS} Open a ${OFF}new terminal${RS} (or reload your shell), then:`);
  console.log(`    ${OFF}claude${RS}            ${DIM}pick an account · ↑↓ move · r rename · d delete · a add${RS}`);
  console.log(`    ${OFF}claude-add work${RS}   ${DIM}add an account from the shell${RS}`);
  console.log(`    ${OFF}claude-acct${RS}       ${DIM}list accounts${RS}`);
  console.log('');
}

function uninstall() {
  banner();
  const files = [path.join(HOME, '.bashrc'), path.join(HOME, '.zshrc')];
  if (process.platform === 'win32') files.push(psProfilePath());
  for (const f of files) {
    if (fs.existsSync(f)) {
      fs.writeFileSync(f, stripBlocks(fs.readFileSync(f, 'utf8')));
      console.log(`  ${GR}✓${RS} unwired  ${FT}${f}${RS}`);
    }
  }
  console.log(`  ${DIM}·${RS} kept ${FT}${DST}${RS} ${DIM}(registry + accounts).${RS}`);
  console.log(`  ${DIM}  delete that folder + each ~/.claude-<name> to fully remove.${RS}`);
  console.log('');
}

function status() {
  banner();
  const reg = path.join(DST, 'profiles.json');
  if (!fs.existsSync(reg)) { console.log(`  ${YEL}not installed${RS} — run  ${OFF}claude-accounts${RS}\n`); return; }
  const { profiles } = JSON.parse(fs.readFileSync(reg, 'utf8'));
  console.log(`  ${profiles.length} account${profiles.length > 1 ? 's' : ''}:`);
  for (const p of profiles) console.log(`    ${OR}•${RS} ${OFF}${p.label}${RS}  ${FT}${p.dir}${RS}`);
  console.log('');
}

const cmd = (process.argv[2] || 'install').toLowerCase();
if (cmd === 'install') install();
else if (cmd === 'uninstall' || cmd === 'remove') uninstall();
else if (cmd === 'status') status();
else { console.log('usage: claude-accounts [install|uninstall|status]'); process.exit(1); }
