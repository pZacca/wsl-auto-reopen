#!/bin/sh
# Installs the packaged .vsix into VS Code on Windows when developing from WSL.
# The Windows `code` CLI refuses to read from \\wsl.localhost, so the .vsix is copied to %TEMP% first.
# Set CODE_CLI=code-insiders (or a fork's CLI) to install somewhere else.
set -eu

code_cli="${CODE_CLI:-code}"
vsix="wsl-auto-reopen-$(node -p "require('./package.json').version").vsix"
[ -f "$vsix" ] || { echo "$vsix not found, run npm run package first" >&2; exit 1; }

cmd_exe="$(command -v cmd.exe)" || { echo "cmd.exe not found, run this from WSL" >&2; exit 1; }
# cmd.exe can't use a \\wsl.localhost directory as its working directory, so run it from its own (Windows) folder.
win() { (cd "$(dirname "$cmd_exe")" && cmd.exe /c "$@"); }

win_temp="$(win echo %TEMP%)"
win_temp="$(printf '%s' "$win_temp" | tr -d '\r')"
case "$win_temp" in
  [A-Za-z]:\\*) ;;
  *) echo "Could not read %TEMP% from Windows (got: $win_temp)" >&2; exit 1 ;;
esac

cp "$vsix" "$(wslpath -u "$win_temp")/"
win "$code_cli" --install-extension "$win_temp\\$vsix" --force
