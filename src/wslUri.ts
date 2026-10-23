export interface WslFolder {
  distro: string;
  path: string;
}

const WSL_HOST = /^wsl(\.localhost|\$)$/i;

/**
 * Maps a folder URI pointing into WSL through a Windows network path
 * (file://wsl.localhost/<distro>/... or file://wsl$/<distro>/...)
 * to its distro and Linux path. Returns undefined for any other URI.
 */
export function parseWslUncUri(scheme: string, authority: string, path: string): WslFolder | undefined {
  if (scheme !== 'file' || !WSL_HOST.test(authority)) return undefined;

  const match = /^\/([^/]+)(.*)$/.exec(path);
  if (!match) return undefined;

  const [, distro, linuxPath] = match;
  return { distro, path: linuxPath || '/' };
}

/**
 * Same as parseWslUncUri, for a path written by hand, e.g. in settings:
 * \\wsl.localhost\<distro>\... or \\wsl$\<distro>\..., with either kind of slash.
 * Trailing slashes are dropped.
 */
export function parseWslUncPath(uncPath: string): WslFolder | undefined {
  const match = /^\/\/([^/]+)(\/.*)$/.exec(uncPath.replace(/\\/g, '/'));
  if (!match) return undefined;

  const folder = parseWslUncUri('file', match[1], match[2]);
  if (!folder) return undefined;
  return { distro: folder.distro, path: folder.path.replace(/\/+$/, '') || '/' };
}

/** The \\wsl.localhost\<distro>\... form of a WSL folder, as Windows shows it. */
export function formatWslUncPath({ distro, path }: WslFolder): string {
  return `\\\\wsl.localhost\\${distro}${path === '/' ? '' : path.replace(/\//g, '\\')}`;
}

/** The path of the file://wsl.localhost/<distro>/... URI for a WSL folder. */
export function wslUncUriPath({ distro, path }: WslFolder): string {
  return `/${distro}${path === '/' ? '' : path}`;
}

/** Returns the first entry that is the folder itself or one of its parents. Distro names are compared case-insensitively. */
export function findExclusion(folder: WslFolder, entries: readonly string[]): string | undefined {
  return entries.find((entry) => {
    const excluded = parseWslUncPath(entry);
    if (!excluded || excluded.distro.toLowerCase() !== folder.distro.toLowerCase()) return false;
    return excluded.path === '/' || folder.path === excluded.path || folder.path.startsWith(`${excluded.path}/`);
  });
}
