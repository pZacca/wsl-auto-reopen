/**
 * Packaged-extension smoke test.
 *
 * 1. Unpack the .vsix built by `npm run package` into a fresh temp directory, away from the repo's node_modules.
 * 2. Check that the files package.json points at are in it.
 * 3. Load the packaged out/extension.js against a fake `vscode` module and activate it, once for a
 *    \\wsl.localhost folder and once for a .code-workspace file (which loads jsonc-parser).
 *
 * Only loading the packaged extension catches a file left out by .vscodeignore, a dependency left out of
 * `dependencies`, or a command declared in package.json but never registered.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACKAGE_ENTRIES = new Set([
  'package.json',
  'package.nls.json',
  'package.nls.pt-br.json',
  'readme.md',
  'changelog.md',
  'LICENSE.txt',
  'images',
  'l10n',
  'node_modules',
  'out',
]);

class SmokeFailure extends Error {}

async function main() {
  const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const vsix = `${name}-${version}.vsix`;
  if (!existsSync(vsix)) fail(`${vsix} not found, run npm run package first`);

  const dir = mkdtempSync(join(tmpdir(), 'wsl-auto-reopen-smoke-'));
  try {
    execFileSync('unzip', ['-q', vsix, '-d', dir]);
    const root = join(dir, 'extension');
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

    // vsce packages everything .vscodeignore doesn't exclude, gitignored files included.
    const unexpected = readdirSync(root).filter((entry) => !PACKAGE_ENTRIES.has(entry));
    if (unexpected.length > 0) fail(`unexpected files in the package: ${unexpected.join(', ')}, see .vscodeignore`);

    for (const file of [manifest.main, manifest.icon, 'package.nls.json', 'l10n/bundle.l10n.pt-br.json']) {
      if (!existsSync(join(root, file))) fail(`${file} is missing from the package`);
    }

    const extension = loadWithFakeVscode(join(root, manifest.main));

    const folder = await activate(extension, {
      folders: [fileUri('/Ubuntu/home/user/project')],
    });
    expectReopen(folder, 'vscode-remote://wsl+Ubuntu/home/user/project');

    const workspace = await activate(extension, {
      workspaceFile: fileUri('/Ubuntu/home/user/app/app.code-workspace'),
      folders: [fileUri('/Ubuntu/home/user/app/api')],
      files: { '/Ubuntu/home/user/app/app.code-workspace': '{ // comment\n "folders": [{ "path": "api" },] }' },
    });
    expectReopen(workspace, 'vscode-remote://wsl+Ubuntu/home/user/app/app.code-workspace');

    for (const { command } of manifest.contributes.commands) {
      if (!folder.registered.includes(command)) fail(`${command} is declared in package.json but not registered`);
    }

    console.log(`smoke: OK ${vsix}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function fail(message) {
  throw new SmokeFailure(message);
}

function expectReopen(run, uri) {
  const opened = run.executed.find(([command]) => command === 'vscode.openFolder');
  if (!opened) fail(`expected a reopen to ${uri}, got none. Log:\n${run.log.join('\n')}`);
  if (opened[1].toString() !== uri) fail(`expected a reopen to ${uri}, got ${opened[1]}`);
}

/** Requires the packaged extension with `vscode` resolved to the fake below. */
function loadWithFakeVscode(main) {
  const load = Module._load;
  Module._load = function (request, ...rest) {
    return request === 'vscode' ? fake : load.call(this, request, ...rest);
  };
  try {
    return createRequire(main)(main);
  } finally {
    Module._load = load;
  }
}

class Uri {
  constructor({ scheme, authority = '', path = '' }) {
    Object.assign(this, { scheme, authority, path });
  }
  static from(parts) {
    return new Uri(parts);
  }
  toString() {
    return `${this.scheme}://${this.authority}${this.path}`;
  }
}

function fileUri(path) {
  return new Uri({ scheme: 'file', authority: 'wsl.localhost', path });
}

// The parts of the vscode API the extension touches, pointed at the current run by activate().
let current;
const fake = {
  Uri,
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  env: { uriScheme: 'vscode', remoteName: undefined },
  l10n: { t: (message) => message },
  extensions: {
    all: [{ id: 'ms-vscode-remote.remote-wsl', packageJSON: { activationEvents: ['onResolveRemoteAuthority:wsl'] } }],
  },
  window: {
    createOutputChannel: () => {
      const write = (...args) => current.log.push(args.join(' '));
      return { info: write, warn: write, error: write, dispose() {} };
    },
    showWarningMessage: async () => undefined,
    showInformationMessage: async () => undefined,
  },
  commands: {
    registerCommand: (command) => {
      current.registered.push(command);
      return { dispose() {} };
    },
    executeCommand: async (...args) => {
      current.executed.push(args);
    },
  },
  workspace: {
    get workspaceFile() {
      return current.workspaceFile;
    },
    get workspaceFolders() {
      return current.folders.map((uri) => ({ uri }));
    },
    getConfiguration: () => ({ get: (_key, fallback) => fallback, update: async () => {} }),
    fs: {
      readFile: async (uri) => {
        const content = current.files[uri.path];
        if (content === undefined) throw new Error(`no such file ${uri.path}`);
        return new TextEncoder().encode(content);
      },
    },
  },
};

async function activate(extension, window) {
  current = { workspaceFile: undefined, files: {}, ...window, log: [], registered: [], executed: [] };
  const run = current;
  extension.activate({ subscriptions: [], globalState: { get: () => true, update: async () => {} } });
  // activate() starts the reopen without awaiting it; let it finish.
  await new Promise((resolve) => setTimeout(resolve, 50));
  return run;
}

await main().catch((err) => {
  console.error(`smoke: FAIL ${err instanceof SmokeFailure ? err.message : err.stack}`);
  process.exitCode = 1;
});
