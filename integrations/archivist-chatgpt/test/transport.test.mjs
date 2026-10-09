import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startServer } from '../src/server.mjs';
import { createMcpHandler, RequestGuard } from '../src/mcp.mjs';
import { demoGeminiFetch } from '../src/demo.mjs';
import { registry } from '../src/archive.mjs';

test('official SDK client initializes, discovers exactly two tools and calls both over real HTTP', async () => {
  const doc = registry[0];
  const server = await startServer({ port: 0, apiKey: 'demo-fixture-key', demo: true, fetchImpl: demoGeminiFetch,
    entryFetchImpl: async () => new Response(`<html><head><link rel="canonical" href="${doc.canonicalUrl}"></head><body><main><h1>Published Entry</h1><p>Real fixture passage.</p></main></body></html>`, { headers: { 'content-type': 'text/html' } }),
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const client = new Client({ name: 'archivist-acceptance', version: '1.0' });
  try {
    const health = await (await fetch(url)).json(); assert.equal(health.mode, 'demo_fixture');
    await client.connect(new StreamableHTTPClientTransport(new URL(url + '/mcp')));
    const { tools } = await client.listTools(); assert.deepEqual(tools.map(tool => tool.name), ['query_archive', 'fetch_entry']);
    for (const tool of tools) { assert.ok(tool.annotations.readOnlyHint); assert.ok(tool.annotations.openWorldHint); assert.equal(tool.annotations.destructiveHint, false); assert.ok(tool.outputSchema); }
    const answer = await client.callTool({ name: 'query_archive', arguments: { question: 'What is the Completion Boundary?' } });
    assert.equal(answer.structuredContent.status, 'grounded'); assert.match(answer.content[0].text, /DEMO FIXTURE/);
    const entry = await client.callTool({ name: 'fetch_entry', arguments: { id: answer.structuredContent.sources[0].id } });
    assert.equal(entry.structuredContent.content_origin, 'live_site'); assert.match(entry.structuredContent.text, /Real fixture passage/);
    const unsupported = await client.callTool({ name: 'query_archive', arguments: { question: 'Uncovered topic' } });
    assert.equal(unsupported.structuredContent.status, 'no_supported_sources');
    const invalid = await client.callTool({ name: 'query_archive', arguments: { question: 'Q', api_key: 'no' } });
    assert.equal(invalid.isError, true); assert.equal(JSON.parse(invalid.content[0].text).code, 'invalid_arguments');
    await assert.rejects(client.callTool({ name: 'delete_archive', arguments: {} }), /Unknown tool/);
  } finally { await client.close(); await new Promise(resolve => server.close(resolve)); }
});

test('web-standard handler rejects untrusted host/origin and bounds the streamed body', async () => {
  const handler = createMcpHandler({ allowedHosts: ['127.0.0.1:8787'] });
  assert.equal((await handler(new Request('http://evil.example/mcp', { method: 'POST' }))).status, 403);
  assert.equal((await handler(new Request('http://127.0.0.1:8787/mcp', { method: 'POST', headers: { Origin: 'https://evil.example' } }))).status, 403);
  const oversized = await handler(new Request('http://127.0.0.1:8787/mcp', { method: 'POST', body: 'x'.repeat(65537), headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' } }));
  assert.equal(oversized.status, 413);
  const preflight = await handler(new Request('http://127.0.0.1:8787/mcp', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:8787' } }));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:8787');
  assert.equal((await handler(new Request('http://127.0.0.1:8787/.well-known/oauth-authorization-server'))).status, 404);
});

test('SDK validates malformed JSON/protocol and stateless GET/DELETE methods', async () => {
  const handler = createMcpHandler();
  const base = 'http://127.0.0.1:8787/mcp';
  for (const method of ['GET', 'DELETE', 'PUT']) assert.equal((await handler(new Request(base, { method }))).status, 405);
  const bad = await handler(new Request(base, { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' } }));
  assert.equal(bad.status, 400);
});

test('request guard bounds active requests and resets the window without storing identities', async () => {
  let now = 0; const guard = new RequestGuard({ now: () => now, concurrent: 1, perMinute: 2 });
  assert.equal(guard.enter(), true); assert.equal(guard.enter(), false); guard.leave();
  assert.equal(guard.enter(), true); guard.leave(); assert.equal(guard.enter(), false);
  now = 60000; assert.equal(guard.enter(), true); guard.leave();
  const handler = createMcpHandler({ guard: new RequestGuard({ perMinute: 0 }) });
  const response = await handler(new Request('http://127.0.0.1:8787/mcp', { method: 'POST' }));
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
});
