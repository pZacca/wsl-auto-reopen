import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWslUncUri } from '../wslUri';

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
