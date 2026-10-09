import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { registry } from '../src/archive.mjs';

const supplied = process.argv[2];
const onlyId = process.argv[3];
const documents = onlyId ? registry.filter(doc => doc.slug === onlyId) : registry;
if (!documents.length) throw new Error('Choose an approved public entry ID.');
if (!supplied) throw new Error('Usage: node scripts/check-hosted.mjs https://YOUR-TEST-WORKER.workers.dev');
const base = new URL(supplied);
if (!['https:', 'http:'].includes(base.protocol) || (base.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(base.hostname)) || base.username || base.password || base.search || base.hash) {
  throw new Error('Use a plain HTTPS test Worker URL, or HTTP loopback for local testing.');
}
base.pathname = '/';
const startedAt = new Date().toISOString();
const healthResponse = await fetch(base, { signal: AbortSignal.timeout(10000) });
assert.equal(healthResponse.status, 200, 'Hosting check must be reachable');
const health = await healthResponse.json();
assert.equal(health.mode, 'free_plan_verification', 'Refusing to test a live-query endpoint');
assert.equal(health.queryEnabled, false);
const client = new Client({ name: 'archivist-hosting-check', version: '0.1' });
const report = { startedAt, endpoint: base.href, mode: health.mode, cpuMeasurement: 'Read Cloudflare invocation logs for this UTC time window; timings below are client elapsed milliseconds, not CPU.', checks: [] };
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', base), { fetch: (url, init) => {
    const headers = new Headers(init?.headers);
    let label = init?.method ?? 'GET';
    if (typeof init?.body === 'string') {
      try {
        const rpc = JSON.parse(init.body);
        label = rpc.params?.name === 'fetch_entry' ? 'fetch:' + rpc.params.arguments.id : rpc.params?.name ?? rpc.method ?? label;
      } catch { /* The MCP SDK reports malformed requests itself. */ }
    }
    headers.set('X-Archivist-Check', label);
    return fetch(url, { ...init, headers, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(30000)]) });
  } }));
  const names = (await client.listTools()).tools.map(tool => tool.name).sort();
  assert.deepEqual(names, ['fetch_entry', 'query_archive']);
  const disabled = await client.callTool({ name: 'query_archive', arguments: { question: 'Hosting check: confirm answer generation is disabled.' } });
  assert.equal(disabled.isError, true);
  assert.equal(JSON.parse(disabled.content[0].text).code, 'archive_unavailable');
  for (const doc of documents) {
    const start = performance.now();
    try {
      const entry = await client.callTool({ name: 'fetch_entry', arguments: { id: doc.slug } });
      const status = entry.structuredContent?.status;
      const ok = status === 'ok' && entry.structuredContent.source.id === doc.slug && entry.structuredContent.source.url === doc.canonicalUrl;
      report.checks.push({ id: doc.slug, ok, elapsedMs: Math.round(performance.now() - start), status: status ?? 'error' });
    } catch {
      report.checks.push({ id: doc.slug, ok: false, elapsedMs: Math.round(performance.now() - start), status: 'transport_error' });
    }
    console.log(JSON.stringify(report.checks.at(-1)));
  }
} finally {
  await client.close();
  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.length === documents.length && report.checks.every(check => check.ok);
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/hosted-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
assert.ok(report.passed, 'One or more published page fetches failed; inspect the report and Cloudflare CPU logs.');
console.log('Published pages fetched: ' + report.checks.length + '/' + documents.length + '. Gemini answer generation remained disabled.');
