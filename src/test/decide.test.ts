import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, type UriParts, type WindowState } from '../decide';

const folder = (path: string, authority = 'wsl.localhost'): UriParts => ({ scheme: 'file', authority, path });

function window(overrides: Partial<WindowState> = {}): WindowState {
  return {
    remoteName: undefined,
    enabled: true,
    exclude: [],
    workspaceFile: undefined,
    folders: [folder('/Ubuntu/home/user/project')],
    resolver: 'ms-vscode-remote.remote-wsl',
    readFile: () => Promise.reject(new Error('unexpected read')),
    ...overrides,
  };
}

test('reopens a single WSL folder', async () => {
  assert.deepEqual(await decide(window()), {
    action: 'reopen',
    target: { distro: 'Ubuntu', path: '/home/user/project' },
    resolver: 'ms-vscode-remote.remote-wsl',
  });
});

test('skips remote windows, disabled windows and non-WSL folders', async () => {
  assert.match(reason(await decide(window({ remoteName: 'wsl' }))), /already remote \(wsl\)/);
  assert.match(reason(await decide(window({ enabled: false }))), /enabled is false/);
  assert.match(reason(await decide(window({ folders: [] }))), /no folder/);
  assert.match(reason(await decide(window({ folders: [folder('/c:/code/app', '')] }))), /not on a WSL network path/);
});

test('skips excluded folders', async () => {
  assert.match(
    reason(await decide(window({ exclude: ['\\\\wsl.localhost\\Ubuntu\\home\\user'] }))),
    /excluded .*\\\\wsl.localhost\\Ubuntu\\home\\user/,
  );
});

test('flags a missing resolver only for folders it would have reopened', async () => {
  assert.deepEqual(await decide(window({ resolver: undefined })), {
    action: 'skip',
    reason: 'no installed extension resolves the wsl remote authority',
    missingResolver: true,
  });
  const notWsl = await decide(window({ resolver: undefined, folders: [folder('/c:/code/app', '')] }));
  assert.equal(notWsl.action === 'skip' && notWsl.missingResolver, undefined);
});

test('reopens a WSL workspace file whose folders carry over', async () => {
  const decision = await decide(
    window({
      workspaceFile: folder('/Ubuntu/home/user/app/app.code-workspace'),
      folders: [folder('/Ubuntu/home/user/app/api'), folder('/Ubuntu/home/user/app/web')],
      readFile: async () => '{ "folders": [{ "path": "api" }, { "path": "web" }] }',
    }),
  );
  assert.deepEqual(decision, {
    action: 'reopen',
    target: { distro: 'Ubuntu', path: '/home/user/app/app.code-workspace' },
    resolver: 'ms-vscode-remote.remote-wsl',
  });
});

test('skips workspace files that are local, untitled, unreadable or have folders that do not carry over', async () => {
  assert.match(
    reason(await decide(window({ workspaceFile: folder('/c:/code/app.code-workspace', '') }))),
    /workspace file is not on a WSL/,
  );
  assert.match(
    reason(await decide(window({ workspaceFile: { scheme: 'untitled', authority: '', path: '/Untitled-1' } }))),
    /workspace file is not on a WSL/,
  );

  const wslWorkspace = folder('/Ubuntu/home/user/app/app.code-workspace');
  assert.match(reason(await decide(window({ workspaceFile: wslWorkspace }))), /could not be read \(unexpected read\)/);
  assert.match(
    reason(
      await decide(
        window({ workspaceFile: wslWorkspace, readFile: async () => '{ "folders": [{ "path": "C:\\\\code" }] }' }),
      ),
    ),
    /absolute path/,
  );
});

test('skips excluded workspace files', async () => {
  const decision = await decide(
    window({
      workspaceFile: folder('/Ubuntu/home/user/app/app.code-workspace'),
      exclude: ['\\\\wsl.localhost\\Ubuntu\\home\\user\\app\\app.code-workspace'],
      readFile: async () => '{ "folders": [] }',
    }),
  );
  assert.match(reason(decision), /excluded/);
});

function reason(decision: Awaited<ReturnType<typeof decide>>): string {
  assert.equal(decision.action, 'skip');
  return decision.action === 'skip' ? decision.reason : '';
}
