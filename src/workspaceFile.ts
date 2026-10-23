import { type ParseError, parse } from 'jsonc-parser';

/**
 * Checks that every folder of a .code-workspace file in WSL means the same thing whether the file is
 * opened through \\wsl.localhost or from inside WSL. VS Code resolves relative folder paths against the
 * workspace file's location, so they carry over, but a few kinds of entries don't:
 * - absolute paths (C:\..., C:foo, /..., \\wsl.localhost\...) and `uri` entries only make sense on one side,
 * - backslashes are separators on Windows but plain characters on Linux,
 * - `..` above the distro root lands on another distro (or the share list) through \\wsl.localhost,
 *   while on Linux it stops at /.
 *
 * Returns why the workspace can't be reopened, or undefined if it can.
 */
export function checkWorkspaceFolders(content: string, workspacePath: string): string | undefined {
  const errors: ParseError[] = [];
  const workspace: unknown = parse(content, errors, { allowTrailingComma: true });
  if (errors.length > 0 || typeof workspace !== 'object' || workspace === null) {
    return 'the workspace file is not valid JSON';
  }

  const folders: unknown = (workspace as { folders?: unknown }).folders ?? [];
  if (!Array.isArray(folders)) return 'the workspace file has no valid "folders" list';

  const depth = workspacePath.split('/').filter(Boolean).length - 1;
  for (const folder of folders) {
    const path: unknown = folder?.path;
    if (typeof path !== 'string') return 'a workspace folder has no relative "path" ("uri" entries are not supported)';
    if (/^([a-zA-Z]:|[\\/])/.test(path)) return `the workspace folder "${path}" is an absolute path`;
    if (path.includes('\\')) return `the workspace folder "${path}" uses Windows separators (\\)`;
    if (climbsAbove(path, depth)) return `the workspace folder "${path}" goes above the distro root`;
  }
  return undefined;
}

function climbsAbove(relativePath: string, depth: number): boolean {
  for (const segment of relativePath.split('/')) {
    if (segment === '..') depth--;
    else if (segment !== '' && segment !== '.') depth++;
    if (depth < 0) return true;
  }
  return false;
}
