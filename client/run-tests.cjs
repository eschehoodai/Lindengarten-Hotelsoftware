const { spawnSync } = require('child_process');

// Windows Node 24 ESM drive-letter normalization:
// Stellt sicher, dass das Arbeitsverzeichnis immer mit einem Großbuchstaben (z. B. C:\) startet,
// um Dual-Module-Ladefehler in Vitest zu verhindern.
const cwd = process.cwd().replace(/^[a-z]:/, (m) => m.toUpperCase());
const args = process.argv.slice(2);
if (args.length === 0) {
  args.push('run');
}

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

const result = spawnSync(cmd, ['vitest', ...args], {
  cwd,
  stdio: 'inherit',
  shell: isWin,
});

process.exit(result.status ?? 0);
