# Changelog

## Unreleased

- **WSL Auto Reopen: Reopen Folder in Windows and Keep It There** command, in the Command Palette and the remote menu of WSL windows. It keeps the folder in Windows either just for you (`wslAutoReopen.exclude`) or for everyone who opens the project (`wslAutoReopen.enabled` in the project settings).
- `wslAutoReopen.exclude` setting: WSL folders and workspace files that stay in Windows, kept in user settings instead of the project.
- Workspace files (`.code-workspace`) stored in WSL are reopened in WSL when all their folders are relative paths inside the distro.
- Every decision is logged to **Output → WSL Auto Reopen**, and reopen errors are no longer lost.
- Warns once when no installed extension can open WSL windows.
- `npm run install:windows` reports Windows-side failures and accepts `CODE_CLI`.
- Release workflow that publishes to the Marketplace, Open VSX and GitHub releases on `v*` tags.
- Marketplace icon.

## 0.1.0

- Initial release: folders opened through `\\wsl.localhost\<distro>\...` or `\\wsl$\<distro>\...` are reopened in a WSL window automatically.
- `wslAutoReopen.enabled` setting, which can be turned off per folder.
- English and Brazilian Portuguese settings descriptions.
