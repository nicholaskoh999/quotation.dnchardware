#!/bin/sh
# ════════════════════════════════════════════════════════════════════════════
#  QUOTATION NEXT — PREVIEW DEPLOY helpers (sourced by both deploy scripts)
#  PREVIEW ONLY — production hosts and docroots are denied.
#
#  Pure POSIX sh functions, tested by deploy/preview/tests/quo-preview-lib.test.sh
#  (run from Pest). No process substitution, no rsync, nothing is deleted.
#
#  qp_resolve_base <configured base> <remote $HOME>
#      '$HOME/x' / '~/x' / '/abs/x' -> an absolute path, resolved HERE (Office),
#      so scp never receives a literal `$HOME` (SFTP-mode scp does not expand
#      it; Preview #1 needed a manual absolute-path upload because of this).
#  qp_deny_check <host> <path>...
#      exit 3 if the host or any path names production (DENY_HOSTS / DENY_PATHS).
#  qp_classify_current <base>
#      prints symlink | absent | known-stub | unknown for <base>/current.
#      cPanel creates a real `current/public/` when the subdomain's docroot is
#      added, and AutoSSL recreates `current/public/.well-known/acme-challenge`
#      when `current` is missing; both block the atomic symlink switch.
#      known-stub = ONLY those cPanel / AutoSSL entries; anything else = unknown.
#  qp_park_stub <base> <tag>
#      keeps any ACME challenge files (copied into the shared ACME dir, never
#      overwriting) and MOVES a known stub to <base>/stubs/current.stub-<tag>.
#  qp_link_acme <base> <release dir>
#      <release>/public/.well-known -> <base>/shared/well-known, so AutoSSL
#      renewals land in one stable directory whatever release is current.
# ════════════════════════════════════════════════════════════════════════════

qp_resolve_base() {
    _qp_b=$1
    _qp_h=${2%/}
    case "$_qp_h" in
        /?*) ;;
        *) echo "FATAL: remote home '$2' is not an absolute path" >&2; return 1 ;;
    esac
    case "$_qp_b" in
        '$HOME') _qp_r=$_qp_h ;;
        '$HOME/'*) _qp_r="$_qp_h/${_qp_b#?HOME/}" ;;
        '~') _qp_r=$_qp_h ;;
        '~/'*) _qp_r="$_qp_h/${_qp_b#??}" ;;
        /*) _qp_r=$_qp_b ;;
        *) echo "FATAL: base '$_qp_b' must be absolute or start with \$HOME/ or ~/" >&2; return 1 ;;
    esac
    _qp_r=${_qp_r%/}
    case "$_qp_r" in
        *'$'* | *'~'* | *'..'* | *'//'* | *' '* | *'"'* | *"'"* | *'`'* | *'\'*)
            echo "FATAL: resolved base '$_qp_r' is not a plain absolute path" >&2; return 1 ;;
    esac
    [ "$_qp_r" != "$_qp_h" ] || { echo "FATAL: base must not be the home directory itself" >&2; return 1; }
    printf '%s\n' "$_qp_r"
}

qp_deny_check() {
    _qp_host=$1
    shift
    for _qp_d in $DENY_HOSTS; do
        case "$_qp_host" in
            "$_qp_d" | *."$_qp_d") echo "FATAL: $_qp_host is a denied (production) host" >&2; return 3 ;;
        esac
    done
    for _qp_p in "$@"; do
        for _qp_d in $DENY_PATHS; do
            case "$_qp_p" in
                *"$_qp_d"*) echo "FATAL: target path $_qp_p touches denied $_qp_d" >&2; return 3 ;;
            esac
        done
    done
    return 0
}

# one entry (relative to current/) that cPanel or AutoSSL is known to create
qp__stub_entry_ok() {
    _qp_e=${2#./}
    _qp_f="$1/$_qp_e"
    [ ! -L "$_qp_f" ] || return 1
    case "$_qp_e" in
        public | public/cgi-bin | public/.well-known | public/.well-known/acme-challenge | \
        cgi-bin | .well-known | .well-known/acme-challenge)
            [ -d "$_qp_f" ] ;;
        public/.htaccess | public/php.ini | public/.user.ini)
            [ -f "$_qp_f" ] && grep -q 'cPanel-generated' "$_qp_f" ;;
        public/.well-known/acme-challenge/* | .well-known/acme-challenge/*)
            case "${_qp_e#*acme-challenge/}" in */*) return 1 ;; esac
            [ -f "$_qp_f" ] ;;
        *) return 1 ;;
    esac
}

qp_classify_current() {
    _qp_c="$1/current"
    if [ -L "$_qp_c" ]; then echo symlink; return 0; fi
    if [ ! -e "$_qp_c" ]; then echo absent; return 0; fi
    if [ ! -d "$_qp_c" ]; then echo unknown; return 0; fi
    _qp_list=$(mktemp) || { echo unknown; return 0; }
    if ! (cd "$_qp_c" && find . -mindepth 1) > "$_qp_list" 2>/dev/null; then
        rm -f "$_qp_list"; echo unknown; return 0
    fi
    _qp_verdict=known-stub
    while IFS= read -r _qp_entry; do
        qp__stub_entry_ok "$_qp_c" "$_qp_entry" || { _qp_verdict=unknown; break; }
    done < "$_qp_list"
    rm -f "$_qp_list"
    echo "$_qp_verdict"
}

qp_park_stub() {
    _qp_base=$1
    _qp_tag=$2
    [ "$(qp_classify_current "$_qp_base")" = known-stub ] || { echo "FATAL: $_qp_base/current is not a known cPanel/AutoSSL stub — nothing moved" >&2; return 1; }
    _qp_acme="$_qp_base/shared/well-known/acme-challenge"
    mkdir -p "$_qp_acme"
    chmod 755 "$_qp_base/shared/well-known" "$_qp_acme"
    for _qp_dir in "$_qp_base/current/public/.well-known/acme-challenge" "$_qp_base/current/.well-known/acme-challenge"; do
        [ -d "$_qp_dir" ] || continue
        for _qp_src in "$_qp_dir"/* "$_qp_dir"/.[!.]*; do
            [ -f "$_qp_src" ] || continue
            [ -e "$_qp_acme/$(basename "$_qp_src")" ] || cp -p "$_qp_src" "$_qp_acme/"
        done
    done
    mkdir -p "$_qp_base/stubs"
    _qp_dest="$_qp_base/stubs/current.stub-$_qp_tag"
    [ ! -e "$_qp_dest" ] || { echo "FATAL: $_qp_dest already exists — nothing moved" >&2; return 1; }
    mv "$_qp_base/current" "$_qp_dest"
    printf '%s\n' "$_qp_dest"
}

qp_link_acme() {
    _qp_base=$1
    _qp_rel=$2
    _qp_wk="$_qp_base/shared/well-known"
    mkdir -p "$_qp_wk/acme-challenge"
    chmod 755 "$_qp_wk" "$_qp_wk/acme-challenge"
    [ ! -e "$_qp_rel/public/.well-known" ] && [ ! -L "$_qp_rel/public/.well-known" ] \
        || { echo "FATAL: release already carries public/.well-known" >&2; return 1; }
    ln -s "$_qp_wk" "$_qp_rel/public/.well-known"
}
