# WSL Auto Reopen

Opens WSL folders straight in a WSL window.

When you open a folder that lives inside WSL through its Windows network path, for example with **Open with Code** in File Explorer on `\\wsl.localhost\Ubuntu\home\you\project`, VS Code opens it as a plain Windows folder and asks you to click **Reopen Folder in WSL**. This extension clicks it for you: the window reloads as `vscode-remote://wsl+Ubuntu/home/you/project`, connected to WSL, with your Linux terminal, extensions and tools.

## How it works

On startup, if the window is a local (non-remote) window with a single folder on `\\wsl.localhost\<distro>\...` or `\\wsl$\<distro>\...`, the extension reopens that same folder in WSL in the same window. Workspace files (`.code-workspace`) stored in WSL are reopened the same way, as long as every folder in them is a relative path that stays inside the distro. Every other window is left alone.

You will see the window load briefly as a Windows folder and then reload in WSL.

The extension activates on startup (`"activationEvents": ["*"]`) on purpose: waiting for `onStartupFinished` would only make that Windows window stay up longer before the reload.

## Requirements

- VS Code on Windows with the [WSL extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl) (or a fork's WSL remote extension that resolves the `wsl` authority). Without one, the extension does nothing and tells you once.

## Keeping a folder in Windows

In a WSL window, run **WSL Auto Reopen: Reopen Folder in Windows and Keep It There** from the Command Palette or the remote menu (the green button at the bottom left). It asks who the folder should stay in Windows for, saves that, and reopens the folder in a Windows window:

- **Only for me** adds the folder to `wslAutoReopen.exclude` in your user settings (`%APPDATA%\Code\User\settings.json`). Nothing in the project changes.
- **For everyone who opens this project** sets `wslAutoReopen.enabled` to `false` in the project settings: `.vscode/settings.json` for a folder, or the `settings` of a `.code-workspace` file. Commit it to share it.

To undo it, remove the entry or the setting again.

The built-in **Reopen Folder in Windows** gets bounced back to WSL, because the extension can't tell it apart from opening the folder from File Explorer.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `wslAutoReopen.enabled` | `true` | Reopen WSL folders in WSL automatically. |
| `wslAutoReopen.exclude` | `[]` | Folders and workspace files that stay in Windows, as `\\wsl.localhost\<distro>\<path>` or `\\wsl$\<distro>\<path>`. An entry also covers everything inside it. User settings only. |

```json
{
  "wslAutoReopen.exclude": ["\\\\wsl.localhost\\Ubuntu\\home\\you\\windows-only"]
}
```

To keep a folder in Windows for everyone who opens it, turn the extension off in that folder's `.vscode/settings.json`, which lives in the project:

```json
{ "wslAutoReopen.enabled": false }
```

## Troubleshooting

Every window logs what the extension decided and why to **Output → WSL Auto Reopen**, for example `Not reopening in WSL: the folder is not on a WSL network path.`

## Limitations

- Single files and untitled multi-root workspaces are not reopened.
- Workspace files with absolute folder paths, `uri` folders, backslashes in folder paths or `..` above the distro root stay in Windows, since those folders would mean something else inside WSL. For the same reason, **Reopen Folder in Windows and Keep It There** refuses WSL workspaces with such folders.

## Development

```sh
npm install
npm run lint              # Biome: lint + formatting (npm run lint:fix to apply)
npm run typecheck
npm test                  # compile + unit tests
npm run package           # builds wsl-auto-reopen-<version>.vsix
npm run smoke             # loads the packaged .vsix against a fake vscode API
npm run install:windows   # from WSL: package and install into VS Code on Windows
```

`npm run smoke` unpacks the `.vsix` away from the repo's `node_modules` and activates the packaged extension, so it catches files left out by `.vscodeignore` or dependencies left out of `dependencies`, which the unit tests can't see.

The extension runs on the Windows side of VS Code, so builds have to be installed there. `npm run install:windows` uses the `code` CLI; set `CODE_CLI=code-insiders` (or a fork's CLI) to install elsewhere. From Windows, `code --install-extension wsl-auto-reopen-<version>.vsix` works too, as long as the `.vsix` is on a Windows drive: the CLI refuses to read from `\\wsl.localhost`.

### Releasing

Bump `version` in `package.json`, update the changelog, commit, then push a matching tag:

```sh
git tag v0.2.0 && git push origin main v0.2.0
```

The release workflow checks that the tag matches `package.json`, runs lint, typecheck, tests and the smoke test, packages the extension once and publishes that `.vsix` to the Visual Studio Marketplace, Open VSX and a GitHub release. It needs the `VSCE_PAT` and `OVSX_PAT` repository secrets.

## License

[MIT](LICENSE)
