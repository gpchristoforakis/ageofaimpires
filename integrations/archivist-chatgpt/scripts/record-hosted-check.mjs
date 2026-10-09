import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
const [endpoint, version, onlyId] = process.argv.slice(2);
const expectedFetches = onlyId ? 1 : 11;
if (!endpoint || !/^[a-f0-9-]{36}$/.test(version ?? '')) throw new Error('Supply the test Worker URL and deployed version UUID.');
const tail = spawn(process.execPath, ['node_modules/wrangler/wrangler-dist/cli.js', 'tail', 'aoai-archivist-free-test', '--config', 'wrangler.free-test.jsonc', '--format', 'json'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let raw = '', exited = false;
tail.stdout.on('data', chunk => { raw += chunk; });
tail.stderr.on('data', () => {});
tail.on('exit', () => { exited = true; });
const records = () => {
  const events = [];
  for (let at = 0; at < raw.length; at++) {
    if (raw[at] !== '{') continue;
    let depth = 0, quote = false, escape = false, end = -1;
    for (let i = at; i < raw.length; i++) {
      const ch = raw[i];
      if (quote) { if (escape) escape = false; else if (ch === '\\') escape = true; else if (ch === '"') quote = false; continue; }
      if (ch === '"') { quote = true; continue; }
      if (ch === '{') depth++; else if (ch === '}' && --depth === 0) { end = i + 1; break; }
    }
    if (end === -1) break;
    try {
      const row = JSON.parse(raw.slice(at, end));
      if (row.outcome) events.push({ outcome: row.outcome, version: row.scriptVersion?.id, cpuTimeMs: row.cpuTime, wallTimeMs: row.wallTime, eventTimestamp: row.eventTimestamp, operation: row.event?.request?.headers?.['x-archivist-check'] ?? 'health', method: row.event?.request?.method, httpStatus: row.event?.response?.status });
    } catch { /* Ignore non-JSON status lines. */ }
    at = end - 1;
  }
  return events;
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let exitCode = 1;
try {
  const deadline = Date.now() + 20000;
  while (!records().length && !exited && Date.now() < deadline) {
    await fetch(endpoint, { signal: AbortSignal.timeout(5000) }).then(response => response.arrayBuffer()).catch(() => {});
    await delay(1000);
  }
  if (!records().length) throw new Error('Cloudflare tail did not receive a readiness probe.');
  const check = spawn(process.execPath, ['scripts/check-hosted.mjs', endpoint, ...(onlyId ? [onlyId] : [])], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  check.stdout.on('data', chunk => process.stdout.write(chunk));
  check.stderr.on('data', chunk => process.stderr.write(chunk));
  exitCode = await new Promise(resolve => check.on('exit', resolve));
  // Allow delayed invocation events to arrive after the 20-second entry
  // deadline; a successful client response can precede the tail event.
  const flushDeadline = Date.now() + 35000;
  while (records().filter(row => row.operation.startsWith('fetch:')).length < expectedFetches && !exited && Date.now() < flushDeadline) await delay(200);
} finally {
  tail.kill('SIGTERM');
  // Persist only timing/status fields; never request bodies, client addresses,
  // authorization headers, or raw tail output.
  const events = records();
  const fetches = events.filter(row => row.operation.startsWith('fetch:'));
  const report = { checkedAt: new Date().toISOString(), endpoint, version, smokeExitCode: exitCode, expectedFetches, capturedFetches: fetches.length, completeCpuSample: fetches.length === expectedFetches, tailEventMarkers: (raw.match(/"outcome"/g) ?? []).length, events };
  await writeFile('artifacts/cloudflare-live-execution.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ capturedFetches: fetches.length, outcomes: [...new Set(events.map(row => row.outcome))], fetches }, null, 2));
}
process.exitCode = exitCode ?? 1;
