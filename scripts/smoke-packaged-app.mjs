import { spawn } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';

const repoRoot = process.cwd();
const executablePath = process.argv[2] ?? join(repoRoot, 'release', 'win-unpacked', 'Suwol 2D Animator.exe');
const timeoutMs = Number(process.env.SUWOL_PACKAGED_SMOKE_TIMEOUT_MS ?? 8000);

if (process.platform !== 'win32') {
  console.log('Packaged app smoke is currently Windows-only; skipping on this platform.');
  process.exit(0);
}

try {
  await access(executablePath, constants.F_OK);
  const executableStat = await stat(executablePath);
  if (executableStat.size <= 0) {
    throw new Error('Executable is empty.');
  }
} catch {
  console.error(`Packaged app executable was not found: ${executablePath}`);
  console.error('Run npm.cmd run dist:win:dir before smoke:packaged.');
  process.exit(1);
}

await verifyPackagedResources(executablePath);

const child = spawn(executablePath, [], {
  detached: false,
  stdio: 'ignore',
  env: {
    ...process.env,
    SUWOL_PACKAGED_SMOKE: '1'
  }
});

let exited = false;
let exitCode = null;
child.on('exit', (code) => {
  exited = true;
  exitCode = code;
});

await delay(timeoutMs);

if (exited) {
  if (exitCode === 0) {
    console.log('Packaged app smoke passed: app launched and exited cleanly.');
    process.exit(0);
  }

  console.error(`Packaged app exited early with code ${exitCode}.`);
  process.exit(1);
}

await killProcessTree(child.pid);
console.log(`Packaged app smoke passed: app launched for ${timeoutMs}ms and was terminated.`);

async function verifyPackagedResources(appExePath) {
  const resourcesPath = join(dirname(appExePath), 'resources');
  try {
    await access(resourcesPath, constants.F_OK);
  } catch {
    console.log('Packaged resource folder check skipped for single-file executable.');
    return;
  }

  const requiredResources = [
    'app.asar',
    'unity/com.suwol.suwol2d/package.json',
    'unity/com.suwol.suwol2d/Samples~/TimelineUsabilityV11/sample_timeline_editing.suwol2d',
    'unity/com.suwol.suwol2d/Documentation~/index.md',
    'docs/packaging-release-readiness-v12.md',
    'docs/manual-qa-dogfooding-v13.md',
    'docs/localization-i18n-v15.md',
    'README.md',
    'LICENSE',
    'THIRD-PARTY-NOTICES.md'
  ];

  for (const resource of requiredResources) {
    const resourcePath = join(resourcesPath, ...resource.split('/'));
    await access(resourcePath, constants.F_OK);
    const resourceStat = await stat(resourcePath);
    if (resourceStat.isFile() && resourceStat.size <= 0) {
      throw new Error(`Packaged resource is empty: ${resourcePath}`);
    }
  }

  console.log(`Packaged resources verified: ${resourcesPath}`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function killProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }

    const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    killer.on('close', () => resolve());
    killer.on('error', () => resolve());
  });
}
