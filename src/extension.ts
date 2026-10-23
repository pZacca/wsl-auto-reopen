import * as vscode from 'vscode';
import { decide } from './decide';
import { formatWslUncPath, parseWslUncPath } from './wslUri';

const MISSING_RESOLVER_WARNED = 'missingResolverWarned';

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('WSL Auto Reopen', { log: true });
  context.subscriptions.push(log);
  autoReopen(context, log).catch((err) => log.error('Reopening in WSL failed:', err));
}

async function autoReopen(context: vscode.ExtensionContext, log: vscode.LogOutputChannel): Promise<void> {
  const config = vscode.workspace.getConfiguration('wslAutoReopen');
  const exclude = readExclude();
  for (const entry of exclude.filter((entry) => !parseWslUncPath(entry))) {
    log.warn(`Ignoring wslAutoReopen.exclude entry that is not a \\\\wsl.localhost or \\\\wsl$ path: ${entry}`);
  }

  const decision = await decide({
    remoteName: vscode.env.remoteName,
    enabled: config.get<boolean>('enabled', true),
    exclude,
    workspaceFile: vscode.workspace.workspaceFile,
    folders: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri),
    resolver: findWslResolver(),
    readFile: async (uri) => new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.from(uri))),
  });

  if (decision.action === 'skip') {
    log.info(`Not reopening in WSL: ${decision.reason}.`);
    if (decision.missingResolver) await warnMissingResolver(context);
    return;
  }

  const { target, resolver } = decision;
  const uri = vscode.Uri.from({ scheme: 'vscode-remote', authority: `wsl+${target.distro}`, path: target.path });
  // The resolver only claims the `wsl` authority in its manifest; whether WSL and the distro actually start is up to it.
  log.info(`Reopening ${formatWslUncPath(target)} as ${uri.toString(true)} through ${resolver}.`);
  await vscode.commands.executeCommand('vscode.openFolder', uri, { forceReuseWindow: true });
}

function readExclude(): string[] {
  const exclude: unknown = vscode.workspace.getConfiguration('wslAutoReopen').get('exclude', []);
  return Array.isArray(exclude) ? exclude.filter((entry): entry is string => typeof entry === 'string') : [];
}

// Reopening only works if some installed extension resolves the `wsl` remote authority
// (ms-vscode-remote.remote-wsl in VS Code, or its equivalent in forks like VSCodium).
function findWslResolver(): string | undefined {
  return vscode.extensions.all.find((ext) => {
    const events: unknown = ext.packageJSON?.activationEvents;
    return Array.isArray(events) && events.includes('onResolveRemoteAuthority:wsl');
  })?.id;
}

async function warnMissingResolver(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(MISSING_RESOLVER_WARNED)) return;
  await context.globalState.update(MISSING_RESOLVER_WARNED, true);

  // Microsoft's WSL extension only works in VS Code itself; forks have their own, so let them search.
  const isVsCode = vscode.env.uriScheme === 'vscode' || vscode.env.uriScheme === 'vscode-insiders';
  const action = isVsCode ? vscode.l10n.t('Show WSL Extension') : vscode.l10n.t('Search Extensions');
  const choice = await vscode.window.showWarningMessage(
    vscode.l10n.t('No installed extension can open WSL windows, so this folder stays in Windows. Install one to have WSL folders reopened in WSL.'),
    action,
  );
  if (choice === action) {
    await vscode.commands.executeCommand('workbench.extensions.search', isVsCode ? '@id:ms-vscode-remote.remote-wsl' : 'wsl');
  }
}
