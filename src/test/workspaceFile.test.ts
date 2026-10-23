import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkWorkspaceFolders } from '../workspaceFile';

const workspace = (folders: unknown) => JSON.stringify({ folders });

test('accepts relative folders, comments and trailing commas', () => {
  assert.equal(
    checkWorkspaceFolders(
      workspace([{ path: '.' }, { path: 'api' }, { path: '../shared/lib' }]),
      '/home/user/app/app.code-workspace',
    ),
    undefined,
  );
  assert.equal(
    checkWorkspaceFolders('{ // folders\n "folders": [{ "path": "web", },], }', '/home/user/app/app.code-workspace'),
    undefined,
  );
  assert.equal(checkWorkspaceFolders('{ "settings": {} }', '/home/user/app/app.code-workspace'), undefined);
});

test('accepts .. up to the distro root', () => {
  assert.equal(
    checkWorkspaceFolders(workspace([{ path: '../../../etc' }]), '/home/user/app/app.code-workspace'),
    undefined,
  );
});

test('rejects .. above the distro root', () => {
  assert.match(
    checkWorkspaceFolders(workspace([{ path: '../../../../Debian/home' }]), '/home/user/app/app.code-workspace') ?? '',
    /above the distro root/,
  );
  assert.match(
    checkWorkspaceFolders(workspace([{ path: 'a/../../x' }]), '/app.code-workspace') ?? '',
    /above the distro root/,
  );
});

test('rejects absolute paths, Windows separators and uri entries', () => {
  const at = '/home/user/app/app.code-workspace';
  assert.match(checkWorkspaceFolders(workspace([{ path: '/srv/app' }]), at) ?? '', /absolute/);
  assert.match(checkWorkspaceFolders(workspace([{ path: 'C:\\code\\app' }]), at) ?? '', /absolute/);
  assert.match(checkWorkspaceFolders(workspace([{ path: 'C:app' }]), at) ?? '', /absolute/);
  assert.match(checkWorkspaceFolders(workspace([{ path: '\\\\wsl.localhost\\Ubuntu\\srv' }]), at) ?? '', /absolute/);
  assert.match(checkWorkspaceFolders(workspace([{ path: 'packages\\api' }]), at) ?? '', /Windows separators/);
  assert.match(checkWorkspaceFolders(workspace([{ uri: 'vscode-remote://ssh-remote+box/srv' }]), at) ?? '', /uri/);
});

test('rejects invalid workspace files', () => {
  assert.match(checkWorkspaceFolders('{ "folders": [', '/a.code-workspace') ?? '', /not valid JSON/);
  assert.match(checkWorkspaceFolders('{ "folders": {} }', '/a.code-workspace') ?? '', /folders/);
});
