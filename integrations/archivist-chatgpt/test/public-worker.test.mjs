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
import { DAILY_QUERY_LIMIT, MONTHLY_QUERY_LIMIT, reserveAttempt, budgetedGeminiFetch } from '../src/query-budget.mjs';

test('UTC budgets reset independently and deny exhausted or corrupt counters', () => {
  const end = { day: '2026-10-09', month: '2026-10', daily: DAILY_QUERY_LIMIT, monthly: MONTHLY_QUERY_LIMIT };
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
const discoveryQuestion = `I'm trying to work out which of two AI assistants is better for writing client proposals. I care about the quality of the final proposal, how much time I spend correcting it, and whether the assistant actually saves me work. What should I read first in AGE OF AIMPIRES? Recommend up to three published readings, explain briefly why each matters, and include links.`;
const beginnerQuestion = `I'm trying to figure out which AI assistant is right for me, but I've never really used one before. Where should I start?`;
const curatedPages = new Map([
  ['framework-effective-task-cost', `<h1>The Effective Task Cost Framework</h1><h2>Start With The Job, Not The Rate Card</h2><p>Define a finished, usable result.</p><h2>When Is It Actually Done?</h2><p>Before comparing two AI tools, decide what done means.</p><h2>What To Measure Instead</h2><p>Track human correction cost.</p><h2>Practical Checklist</h2>`],
  ['age-of-aimpires-entry-01', `<h1>Fast AI. Expensive Lesson.</h1><h2>When Cheap Creates More Repair Work</h2><p>Count retries and corrections.</p><h2>The Completion Boundary</h2><p>Measure human involvement.</p><h2>What To Measure Instead</h2>`],
  ['framework-effective-task-cost-operators-deep-dive', `<h1>The Effective Task Cost Framework: The Operator's Deep Dive</h1><h2>02. The Completion Boundary</h2><h2>05. The Operational Metrics to Track</h2><h3>First-Time Success</h3><h3>Human Involvement</h3><h3>Cost Per Completed Job</h3><p>Track first-time success and cost per completed job.</p>`],
].map(([id, body]) => {
  const source = registry.find(item => item.slug === id);
  return [source.canonicalUrl, `<!doctype html><html><head><link rel="canonical" href="${source.canonicalUrl}"></head><body><main>${body}</main></body></html>`];
}));
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

test('hybrid discovery stays inactive until the production release gate is enabled', async () => {
  let providerCalls = 0;
  let pageCalls = 0;
  const runtime = new Miniflare(runtimeOptions({
    GEMINI_API_KEY: 'private-test-key', ARCHIVIST_QUERY_ENABLED: 'true',
  }, async request => {
    if (curatedPages.has(request.url)) {
      pageCalls++;
      return new Response(curatedPages.get(request.url), { headers: { 'Content-Type': 'text/html' } });
    }
    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    providerCalls++;
    return Response.json(grounded);
  }));
  const client = await connect(runtime);
  try {
    const health = await (await runtime.dispatchFetch('https://mcp.example/')).json();
    assert.equal(health.hybridDiscoveryEnabled, false);
    const result = await client.callTool({ name: 'query_archive', arguments: { question: discoveryQuestion } });
    assert.equal(result.structuredContent.content_origin, 'file_search');
    assert.equal(result.structuredContent.selection_origin, undefined);
    assert.equal(providerCalls, 1);
    assert.equal(pageCalls, 0);
  } finally { await client.close(); await runtime.dispose(); }
});

test('shared persistent budget counts every provider retry, survives restart, and leaves page reading available', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'archivist-budget-test-'));
  let providerCalls = 0;
  const bindings = { GEMINI_API_KEY: 'private-test-key', ARCHIVIST_QUERY_ENABLED: 'true', ARCHIVIST_HYBRID_DISCOVERY_ENABLED: 'true' };
  const outbound = async request => {
    if (request.url === 'https://ageofaimpires.com/about') return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    if (curatedPages.has(request.url)) return new Response(curatedPages.get(request.url), { headers: { 'Content-Type': 'text/html' } });
    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    const body = await request.json();
    assert.equal(body.generationConfig.maxOutputTokens, 2048);
    providerCalls++;
    // A retry consumes a second permit, leaving the rest of the daily allowance.
    if (providerCalls === 1) return Response.json({ error: { message: 'UNAVAILABLE' } }, { status: 503 });
    return Response.json(grounded);
  };
  let runtime = new Miniflare(runtimeOptions(bindings, outbound, { resourcePersistencePath: directory }));
  let client = await connect(runtime);
  try {
    assert.equal((await (await runtime.dispatchFetch('https://mcp.example/')).json()).hybridDiscoveryEnabled, true);
    const curated = await client.callTool({ name: 'query_archive', arguments: { question: beginnerQuestion } });
    assert.equal(curated.structuredContent.status, 'grounded');
    assert.equal(curated.structuredContent.content_origin, 'live_site');
    assert.equal(curated.structuredContent.selection_origin, 'curated');
    assert.deepEqual(curated.structuredContent.sources.map(source => source.id), [
      'framework-effective-task-cost',
    ]);
    assert.equal(providerCalls, 0, 'Curated discovery must not reserve or call the Gemini provider');
    const first = await client.callTool({ name: 'query_archive', arguments: { question: 'Q' } });
    assert.equal(first.structuredContent.status, 'grounded');
    assert.equal(providerCalls, 2);
    await client.close(); await runtime.dispose();
    runtime = new Miniflare(runtimeOptions(bindings, outbound, { resourcePersistencePath: directory }));
    client = await connect(runtime);
    const stub = (await runtime.getDurableObjectNamespace('ARCHIVIST_QUERY_BUDGET')).getByName('public-provider-attempts-v1');
    const reservations = await Promise.all(Array.from({ length: DAILY_QUERY_LIMIT + 5 }, async () =>
      (await (await stub.fetch('https://budget.internal/reserve', { method: 'POST' })).json()).allowed));
    assert.equal(reservations.filter(Boolean).length, DAILY_QUERY_LIMIT - 2, 'Concurrent reservations must respect persisted usage');
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
