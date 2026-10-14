# WSL Auto Reopen

Opens WSL folders straight in a WSL window.

When you open a folder that lives inside WSL through its Windows network path, for example with **Open with Code** in File Explorer on `\\wsl.localhost\Ubuntu\home\you\project`, VS Code opens it as a plain Windows folder and asks you to click **Reopen Folder in WSL**. This extension clicks it for you: the window reloads as `vscode-remote://wsl+Ubuntu/home/you/project`, connected to WSL, with your Linux terminal, extensions and tools.

## How it works

On startup, if the window is a local (non-remote) window with a single folder on `\\wsl.localhost\<distro>\...` or `\\wsl$\<distro>\...`, the extension reopens that same folder in WSL in the same window. Every other window is left alone.

You will see the window load briefly as a Windows folder and then reload in WSL.

## Requirements

- VS Code on Windows with the [WSL extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl) (or a fork's WSL remote extension that resolves the `wsl` authority). Without one, the extension does nothing.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `wslAutoReopen.enabled` | `true` | Reopen WSL folders in WSL automatically. |

To keep one specific folder in a Windows window, put this in that folder's `.vscode/settings.json`:

```json
{ "wslAutoReopen.enabled": false }
```

## Limitations

- Multi-root workspaces (`.code-workspace`) and single files are not reopened.
- **Reopen Folder in Windows** from a WSL window gets bounced back to WSL. Disable the setting for that folder (see above) if you want it in Windows.

## Development

```sh
npm install
npm test                  # compile + unit tests
npm run package           # builds wsl-auto-reopen-<version>.vsix
npm run install:windows   # from WSL: package and install into VS Code on Windows
```

The extension runs on the Windows side of VS Code, so builds have to be installed there. From Windows, `code --install-extension wsl-auto-reopen-<version>.vsix` works too, as long as the `.vsix` is on a Windows drive: the CLI refuses to read from `\\wsl.localhost`.

## License

[MIT](LICENSE)
