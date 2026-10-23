import * as vscode from 'vscode';
import { decide } from './decide';
import { checkWorkspaceFolders } from './workspaceFile';
import { findExclusion, formatWslUncPath, parseWslUncPath, wslUncUriPath } from './wslUri';

const MISSING_RESOLVER_WARNED = 'missingResolverWarned';

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('WSL Auto Reopen', { log: true });
  context.subscriptions.push(
    log,
    vscode.commands.registerCommand('wslAutoReopen.reopenInWindows', () =>
      reopenInWindows(log).catch((err) => log.error('Reopening in Windows failed:', err)),
    ),
  );
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

/**
 * Keeps the current WSL folder or workspace out of auto reopen, either for this user (wslAutoReopen.exclude)
 * or for the project (wslAutoReopen.enabled in its settings), then reopens it through \\wsl.localhost.
 */
async function reopenInWindows(log: vscode.LogOutputChannel): Promise<void> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const current = vscode.workspace.workspaceFile ?? (folders.length === 1 ? folders[0].uri : undefined);
  const distro = current?.scheme === 'vscode-remote' ? /^wsl\+(.+)$/.exec(current.authority)?.[1] : undefined;
  if (!current || !distro) {
    void vscode.window.showInformationMessage(
      vscode.l10n.t('Open a single WSL folder or a saved workspace in WSL first.'),
    );
    return;
  }

  const target = { distro, path: current.path };
  if (vscode.workspace.workspaceFile) {
    const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(current));
    const problem = checkWorkspaceFolders(content, target.path);
    if (problem) {
      log.info(`Not reopening in Windows: ${problem}.`);
      void vscode.window.showWarningMessage(
        vscode.l10n.t('This workspace cannot be opened from Windows: {0}.', problem),
      );
      return;
    }
  }

  // A .code-workspace keeps its settings in the file itself; a folder keeps them in .vscode/settings.json.
  const projectSettings = vscode.workspace.workspaceFile
    ? target.path.slice(target.path.lastIndexOf('/') + 1)
    : '.vscode/settings.json';
  const forMe: vscode.QuickPickItem = {
    label: vscode.l10n.t('Only for me'),
    detail: vscode.l10n.t('Adds it to wslAutoReopen.exclude in your user settings.'),
  };
  const forProject: vscode.QuickPickItem = {
    label: vscode.l10n.t('For everyone who opens this project'),
    detail: vscode.l10n.t('Sets wslAutoReopen.enabled to false in {0}, which is part of the project.', projectSettings),
  };
  const choice = await vscode.window.showQuickPick([forMe, forProject], {
    placeHolder: vscode.l10n.t('Keep it in Windows for whom?'),
  });
  if (!choice) return;

  const config = vscode.workspace.getConfiguration('wslAutoReopen');
  if (choice === forProject) {
    await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
    log.info(`Set wslAutoReopen.enabled to false in ${projectSettings}.`);
  } else {
    const exclude = readExclude();
    if (!findExclusion(target, exclude)) {
      const entry = formatWslUncPath(target);
      await config.update('exclude', [...exclude, entry], vscode.ConfigurationTarget.Global);
      log.info(`Added ${entry} to wslAutoReopen.exclude.`);
    }
  }

  const uri = vscode.Uri.from({ scheme: 'file', authority: 'wsl.localhost', path: wslUncUriPath(target) });
  // Without forceLocalWindow, openFolder keeps the current window's remote authority.
  await vscode.commands.executeCommand('vscode.openFolder', uri, { forceReuseWindow: true, forceLocalWindow: true });
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
    vscode.l10n.t(
      'No installed extension can open WSL windows, so this folder stays in Windows. Install one to have WSL folders reopened in WSL.',
    ),
    action,
  );
  if (choice === action) {
    await vscode.commands.executeCommand(
      'workbench.extensions.search',
      isVsCode ? '@id:ms-vscode-remote.remote-wsl' : 'wsl',
    );
  }
}
