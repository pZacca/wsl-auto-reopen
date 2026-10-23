import { checkWorkspaceFolders } from './workspaceFile';
import { findExclusion, parseWslUncUri, type WslFolder } from './wslUri';

export interface UriParts {
  scheme: string;
  authority: string;
  path: string;
}

/** What activate() knows about the window, without the vscode API, so the decision can be unit-tested. */
export interface WindowState {
  remoteName: string | undefined;
  enabled: boolean;
  exclude: readonly string[];
  workspaceFile: UriParts | undefined;
  folders: readonly UriParts[];
  /** Id of an installed extension that declares it resolves the `wsl` remote authority. */
  resolver: string | undefined;
  readFile(uri: UriParts): Promise<string>;
}

export type Decision =
  | { action: 'reopen'; target: WslFolder; resolver: string }
  | { action: 'skip'; reason: string; missingResolver?: true };

export async function decide(window: WindowState): Promise<Decision> {
  if (window.remoteName) return skip(`the window is already remote (${window.remoteName})`);
  if (!window.enabled) return skip('wslAutoReopen.enabled is false');

  const target = window.workspaceFile
    ? await workspaceTarget(window.workspaceFile, window.readFile)
    : folderTarget(window.folders);
  if (typeof target === 'string') return skip(target);

  const exclusion = findExclusion(target, window.exclude);
  if (exclusion) return skip(`it is excluded by the wslAutoReopen.exclude entry ${exclusion}`);

  if (!window.resolver) {
    return { action: 'skip', reason: 'no installed extension resolves the wsl remote authority', missingResolver: true };
  }
  return { action: 'reopen', target, resolver: window.resolver };
}

function skip(reason: string): Decision {
  return { action: 'skip', reason };
}

function folderTarget(folders: readonly UriParts[]): WslFolder | string {
  if (folders.length !== 1) return folders.length === 0 ? 'no folder is open' : 'more than one folder is open';

  const { scheme, authority, path } = folders[0];
  return parseWslUncUri(scheme, authority, path) ?? 'the folder is not on a WSL network path';
}

async function workspaceTarget(
  workspaceFile: UriParts,
  readFile: WindowState['readFile'],
): Promise<WslFolder | string> {
  const target = parseWslUncUri(workspaceFile.scheme, workspaceFile.authority, workspaceFile.path);
  if (!target) return 'the workspace file is not on a WSL network path';

  let content: string;
  try {
    content = await readFile(workspaceFile);
  } catch (err) {
    return `the workspace file could not be read (${err instanceof Error ? err.message : String(err)})`;
  }
  return checkWorkspaceFolders(content, target.path) ?? target;
}
