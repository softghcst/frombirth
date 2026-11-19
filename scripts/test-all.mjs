// Runs every check in tests/, several at a time, and reports which failed.
// Run with: node scripts/test-all.mjs [--jobs N] [--timeout SECONDS] [name-filter]
// Exits with 1 if any check fails or runs out of time. Each failing check's output is printed in full.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; args.splice(i, 2); return v; };
const jobs = Math.max(1, Number(opt('--jobs', Math.max(1, Math.min(8, cpus().length)))));
const timeout = Number(opt('--timeout', 900)) * 1000;
const filter = args[0] ?? '';
const files = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.mjs') && f.includes(filter)).sort();

const results = [];
const started = Date.now();
function run(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [join('tests', file)], { cwd: root, env: process.env });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { out += `\n[timed out after ${timeout / 1000}s]`; child.kill('SIGKILL'); }, timeout);
    child.on('close', (code) => { clearTimeout(timer); resolve({ file, ok: code === 0, out, secs: Math.round((Date.now() - t0) / 1000) }); });
  });
}
const queue = [...files];
await Promise.all(Array.from({ length: jobs }, async () => {
  while (queue.length) {
    const r = await run(queue.shift());
    results.push(r);
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file} (${r.secs}s)`);
  }
}));
const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`\n---------- ${r.file} ----------\n${r.out.trim().split('\n').slice(-40).join('\n')}`);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed in ${Math.round((Date.now() - started) / 1000)}s.`);
process.exit(failed.length ? 1 : 0);
