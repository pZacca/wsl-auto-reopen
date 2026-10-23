import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findExclusion, formatWslUncPath, parseWslUncPath, parseWslUncUri, wslUncUriPath } from '../wslUri';

test('maps \\\\wsl.localhost folders to distro and Linux path', () => {
  assert.deepEqual(parseWslUncUri('file', 'wsl.localhost', '/Ubuntu/home/user/project'), {
    distro: 'Ubuntu',
    path: '/home/user/project',
  });
});

test('maps legacy \\\\wsl$ folders', () => {
  assert.deepEqual(parseWslUncUri('file', 'wsl$', '/Debian/srv/app'), { distro: 'Debian', path: '/srv/app' });
});

test('matches the host case-insensitively', () => {
  assert.deepEqual(parseWslUncUri('file', 'WSL.LOCALHOST', '/Ubuntu/tmp'), { distro: 'Ubuntu', path: '/tmp' });
});

test('maps the distro root to /', () => {
  assert.deepEqual(parseWslUncUri('file', 'wsl.localhost', '/Ubuntu'), { distro: 'Ubuntu', path: '/' });
  assert.deepEqual(parseWslUncUri('file', 'wsl.localhost', '/Ubuntu/'), { distro: 'Ubuntu', path: '/' });
});

test('keeps spaces and non-ASCII characters in the path', () => {
  assert.deepEqual(parseWslUncUri('file', 'wsl.localhost', '/Ubuntu-24.04/home/user/meus projetos/ação'), {
    distro: 'Ubuntu-24.04',
    path: '/home/user/meus projetos/ação',
  });
});

test('ignores folders that are not on a WSL network path', () => {
  assert.equal(parseWslUncUri('file', '', '/c:/Users/user/project'), undefined);
  assert.equal(parseWslUncUri('file', 'fileserver', '/share/project'), undefined);
  assert.equal(parseWslUncUri('file', 'wsl.localhost.evil.com', '/Ubuntu/home'), undefined);
  assert.equal(parseWslUncUri('vscode-remote', 'wsl+Ubuntu', '/home/user/project'), undefined);
});

test('ignores the bare \\\\wsl.localhost share list', () => {
  assert.equal(parseWslUncUri('file', 'wsl.localhost', '/'), undefined);
  assert.equal(parseWslUncUri('file', 'wsl.localhost', ''), undefined);
});

test('parses hand-written \\\\wsl.localhost and \\\\wsl$ paths with either slash', () => {
  assert.deepEqual(parseWslUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user\\project'), {
    distro: 'Ubuntu',
    path: '/home/user/project',
  });
  assert.deepEqual(parseWslUncPath('//wsl$/Ubuntu/home/user/project/'), {
    distro: 'Ubuntu',
    path: '/home/user/project',
  });
  assert.deepEqual(parseWslUncPath('\\\\wsl.localhost\\Ubuntu\\'), { distro: 'Ubuntu', path: '/' });
  assert.equal(parseWslUncPath('C:\\Users\\user\\project'), undefined);
  assert.equal(parseWslUncPath('/home/user/project'), undefined);
  assert.equal(parseWslUncPath('\\\\fileserver\\share'), undefined);
});

test('formats WSL folders back to \\\\wsl.localhost paths and URI paths', () => {
  assert.equal(
    formatWslUncPath({ distro: 'Ubuntu', path: '/home/user/project' }),
    '\\\\wsl.localhost\\Ubuntu\\home\\user\\project',
  );
  assert.equal(formatWslUncPath({ distro: 'Ubuntu', path: '/' }), '\\\\wsl.localhost\\Ubuntu');
  assert.equal(wslUncUriPath({ distro: 'Ubuntu', path: '/home/user/project' }), '/Ubuntu/home/user/project');
  assert.equal(wslUncUriPath({ distro: 'Ubuntu', path: '/' }), '/Ubuntu');
});

test('finds exclusions for the folder itself and its parents', () => {
  const folder = { distro: 'Ubuntu', path: '/home/user/project' };
  assert.equal(
    findExclusion(folder, ['\\\\wsl.localhost\\Ubuntu\\home\\user\\project']),
    '\\\\wsl.localhost\\Ubuntu\\home\\user\\project',
  );
  assert.equal(findExclusion(folder, ['\\\\wsl$\\ubuntu\\home\\user']), '\\\\wsl$\\ubuntu\\home\\user');
  assert.equal(findExclusion(folder, ['\\\\wsl.localhost\\Ubuntu']), '\\\\wsl.localhost\\Ubuntu');
});

test('does not match exclusions for siblings, children, other distros or invalid entries', () => {
  const folder = { distro: 'Ubuntu', path: '/home/user/project' };
  assert.equal(findExclusion(folder, ['\\\\wsl.localhost\\Ubuntu\\home\\user\\project-old']), undefined);
  assert.equal(findExclusion(folder, ['\\\\wsl.localhost\\Ubuntu\\home\\user\\project\\sub']), undefined);
  assert.equal(findExclusion(folder, ['\\\\wsl.localhost\\Debian\\home\\user\\project']), undefined);
  assert.equal(findExclusion(folder, ['/home/user/project', 'C:\\home\\user\\project']), undefined);
  assert.equal(
    findExclusion({ distro: 'Ubuntu', path: '/home/User/project' }, ['\\\\wsl.localhost\\Ubuntu\\home\\user']),
    undefined,
  );
});
