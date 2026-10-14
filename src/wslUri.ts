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
