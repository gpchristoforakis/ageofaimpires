import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fileURLToPath } from 'node:url';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { registry } from '../src/archive.mjs';
import { reserveAttempt, budgetedGeminiFetch } from '../src/query-budget.mjs';

test('UTC budgets reset independently and deny exhausted or corrupt counters', () => {
  const end = { day: '2026-10-09', month: '2026-10', daily: 25, monthly: 250 };
  assert.equal(reserveAttempt(end, new Date('2026-10-09T23:59:59Z')).allowed, false);
  assert.equal(reserveAttempt(end, new Date('2026-10-10T00:00:00Z')).allowed, false);
  assert.deepEqual(reserveAttempt(end, new Date('2026-11-01T00:00:00Z')).state,
    { day: '2026-11-01', month: '2026-11', daily: 1, monthly: 1 });
  assert.equal(reserveAttempt({ ...end, monthly: 30 }, new Date('2026-10-10T00:00:00Z')).state.monthly, 31);
  assert.throws(() => reserveAttempt({ ...end, daily: NaN }, new Date('2026-10-09T12:00:00Z')));
});

test('budget outages and malformed permissions never call Gemini', async () => {
  let calls = 0;
  for (const namespace of [undefined, { idFromName: () => 'id', get: () => ({ fetch: () => Response.json({ allowed: 'true' }) }) }]) {
    await assert.rejects(budgetedGeminiFetch(namespace, () => { calls++; })
      ('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', { body: '{}' }),
      error => error.code === 'archive_unavailable');
  }
  assert.equal(calls, 0);
});

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/public-worker.mjs', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const html = await readFile(new URL('../../../about.html', import.meta.url), 'utf8');
const doc = registry[0];
const grounded = { candidates: [{ content: { parts: [{ text: 'Budget fixture.' }] }, groundingMetadata: {
  groundingChunks: [{ retrievedContext: { uri: doc.fileSearchDocName } }], groundingSupports: [{ groundingChunkIndices: [0] }],
} }] };
function runtimeOptions(bindings, outboundService, extra = {}) {
  return convertV4MiniflareOptions({ name: 'archivist-public-test', modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-10-09', bindings, outboundService,
    durableObjects: { ARCHIVIST_QUERY_BUDGET: { className: 'ArchiveQueryBudget', useSQLite: true } }, ...extra });
}
async function connect(runtime) {
  const client = new Client({ name: 'public-worker-check', version: '0.1' });
  await client.connect(new StreamableHTTPClientTransport(new URL('https://mcp.example/mcp'),
    { fetch: (url, init) => runtime.dispatchFetch(String(url), init) }));
  return client;
}

test('explicit activation, missing secrets and domain verification are handled safely', async () => {
  let calls = 0;
  for (const bindings of [{}, { GEMINI_API_KEY: 'private-test-key' }, { ARCHIVIST_QUERY_ENABLED: 'true' }]) {
    const runtime = new Miniflare(runtimeOptions({ ...bindings, OPENAI_APPS_CHALLENGE: 'test-domain-token' }, () => { calls++; throw new Error('Unexpected call'); }));
    const client = await connect(runtime);
    try {
      assert.equal((await (await runtime.dispatchFetch('https://mcp.example/')).json()).queryEnabled, false);
      const result = await client.callTool({ name: 'query_archive', arguments: { question: 'Explain completion.' } });
      assert.equal(result.isError, true);
      assert.doesNotMatch(JSON.stringify(result), /private-test-key/);
      assert.equal(await (await runtime.dispatchFetch('https://mcp.example/.well-known/openai-apps-challenge')).text(), 'test-domain-token');
    } finally { await client.close(); await runtime.dispose(); }
  }
  assert.equal(calls, 0);
});

test('shared persistent budget counts every provider retry, survives restart, and leaves page reading available', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'archivist-budget-test-'));
  let providerCalls = 0;
  const bindings = { GEMINI_API_KEY: 'private-test-key', ARCHIVIST_QUERY_ENABLED: 'true' };
  const outbound = async request => {
    if (request.url === 'https://ageofaimpires.com/about') return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    const body = await request.json();
    assert.equal(body.generationConfig.maxOutputTokens, 2048);
    providerCalls++;
    // A retry consumes a second permit, leaving 23 more outbound attempts.
    if (providerCalls === 1) return Response.json({ error: { message: 'UNAVAILABLE' } }, { status: 503 });
    return Response.json(grounded);
  };
  let runtime = new Miniflare(runtimeOptions(bindings, outbound, { resourcePersistencePath: directory }));
  let client = await connect(runtime);
  try {
    const first = await client.callTool({ name: 'query_archive', arguments: { question: 'Q' } });
    assert.equal(first.structuredContent.status, 'grounded');
    assert.equal(providerCalls, 2);
    await client.close(); await runtime.dispose();
    runtime = new Miniflare(runtimeOptions(bindings, outbound, { resourcePersistencePath: directory }));
    client = await connect(runtime);
    const stub = (await runtime.getDurableObjectNamespace('ARCHIVIST_QUERY_BUDGET')).getByName('public-provider-attempts-v1');
    const reservations = await Promise.all(Array.from({ length: 30 }, async () =>
      (await (await stub.fetch('https://budget.internal/reserve', { method: 'POST' })).json()).allowed));
    assert.equal(reservations.filter(Boolean).length, 23, 'Concurrent reservations must respect persisted usage');
    const denied = await client.callTool({ name: 'query_archive', arguments: { question: 'Q' } });
    assert.equal(JSON.parse(denied.content[0].text).code, 'archive_limit_reached');
    assert.equal(providerCalls, 2);
    const page = await client.callTool({ name: 'fetch_entry', arguments: { id: 'about' } });
    assert.equal(page.structuredContent.status, 'ok');
  } finally {
    await client.close(); await runtime.dispose();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('archivist-budget-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});
