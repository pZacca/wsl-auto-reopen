#!/bin/sh
# Installs the packaged .vsix into VS Code on Windows when developing from WSL.
# The Windows `code` CLI refuses to read from \\wsl.localhost, so the .vsix is copied to %TEMP% first.
set -eu

vsix="wsl-auto-reopen-$(node -p "require('./package.json').version").vsix"
win_temp="$(cmd.exe /c echo %TEMP% 2>/dev/null | tr -d '\r')"

cp "$vsix" "$(wslpath -u "$win_temp")/"
cmd.exe /c code --install-extension "$win_temp\\$vsix" --force 2>/dev/null
