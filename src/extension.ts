import * as vscode from 'vscode';
import { parseWslUncUri } from './wslUri';

export function activate(): void {
  if (vscode.env.remoteName) return;
  if (!vscode.workspace.getConfiguration('wslAutoReopen').get<boolean>('enabled', true)) return;
  if (vscode.workspace.workspaceFile) return;

  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length !== 1) return;

  const { scheme, authority, path } = folders[0].uri;
  const target = parseWslUncUri(scheme, authority, path);
  if (!target || !hasWslResolver()) return;

  const uri = vscode.Uri.from({ scheme: 'vscode-remote', authority: `wsl+${target.distro}`, path: target.path });
  void vscode.commands.executeCommand('vscode.openFolder', uri, { forceReuseWindow: true });
}

export function deactivate(): void {}

// Reopening only works if some installed extension resolves the `wsl` remote authority
// (ms-vscode-remote.remote-wsl in VS Code, or its equivalent in forks like VSCodium).
function hasWslResolver(): boolean {
  return vscode.extensions.all.some((ext) => {
    const events: unknown = ext.packageJSON?.activationEvents;
    return Array.isArray(events) && events.includes('onResolveRemoteAuthority:wsl');
  });
}
