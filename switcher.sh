# Claude account switcher (bash/zsh) — edunascimentt.dev
# Thin wrapper; all logic lives in acctinfo.js (Node).
CA_DIR="$HOME/.claude-accounts"
CA_REG="$CA_DIR/profiles.json"
CA_INFO="$CA_DIR/acctinfo.js"

# Resolve the claude binary (PATH name differs by platform).
_ca_bin() { command -v claude.exe >/dev/null 2>&1 && echo claude.exe || echo claude; }

_ca_launch() {
    local dir="$1"; shift
    local bin; bin="$(_ca_bin)"
    # `command` bypasses the claude() wrapper function below — without it the
    # lookup resolves to the function again and recurses forever.
    if [ "$dir" = "DEFAULT" ]; then ( unset CLAUDE_CONFIG_DIR; command "$bin" "$@" )
    else ( export CLAUDE_CONFIG_DIR="$dir"; command "$bin" "$@" ); fi
}

claude() {
    if [ "$#" -gt 0 ]; then _ca_launch DEFAULT "$@"; return; fi
    if ! command -v node >/dev/null 2>&1; then
        printf '  Node.js required for the account picker. Install: https://nodejs.org\n'; return
    fi
    local dir; dir="$(node "$CA_INFO" ui "$CA_REG")"
    if [ -n "$dir" ]; then _ca_launch "$dir"; else printf '    \033[38;2;138;138;138mcancelled\033[0m\n'; fi
}

claude-add() {
    if ! command -v node >/dev/null 2>&1; then printf '  Node.js required.\n'; return; fi
    local name="$1"
    # zsh's read has no -p prompt flag — print the prompt separately
    [ -z "$name" ] && { printf '  new account name: '; read -r name; }
    [ -z "$name" ] && { printf '  cancelled\n'; return; }
    printf '  creating account…\n'
    local dir; dir="$(node "$CA_INFO" add "$CA_REG" "$name" "$HOME")"
    [ -z "$dir" ] && { printf '  \033[31mfailed to create account\033[0m\n'; return; }
    printf "  \033[32madded '%s'  ->  %s\033[0m\n" "$name" "$dir"
    printf '  launching (log in with this account)…\n'
    _ca_launch "$dir"
}

claude-acct() { command -v node >/dev/null 2>&1 && node "$CA_INFO" status "$CA_REG"; }

claude-use() {
    local key="$1"; shift 2>/dev/null
    local dir; dir="$(node "$CA_INFO" dir "$CA_REG" "$key")"
    [ -n "$dir" ] && _ca_launch "$dir" "$@" || printf "  \033[31mno account: %s\033[0m\n" "$key"
}

claude-rm() {
    local key="$1" purge="$2"
    command -v node >/dev/null 2>&1 || return
    local dir; dir="$(node "$CA_INFO" remove "$CA_REG" "$key")"
    [ -z "$dir" ] && { printf "  \033[33mcannot remove '%s' (unknown or the default account)\033[0m\n" "$key"; return; }
    if [ "$purge" = "--purge" ] && [ -d "$dir" ]; then rm -rf "$dir"; printf "  \033[32mremoved '%s' (config dir deleted)\033[0m\n" "$key"
    else printf "  \033[32mremoved '%s' (config dir kept at %s)\033[0m\n" "$key" "$dir"; fi
}

claude-personal() { _ca_launch DEFAULT "$@"; }
claude-work() { claude-use work "$@"; }
alias cpers='claude-personal'
alias cwork='claude-work'
