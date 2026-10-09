import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/archive.mjs';

test('Cloudflare runtime executes strict archive query through SDK with mocked Gemini', async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/worker.mjs', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  const doc = registry[0];
  const candidates = [
    { content: { parts: [{ text: 'Grounded worker fixture.' }] }, groundingMetadata: {
      groundingChunks: [{ retrievedContext: { uri: doc.fileSearchDocName } }], groundingSupports: [{ groundingChunkIndices: [0] }],
    } },
    { content: { parts: [{ text: 'Do not expose draft text.' }] }, groundingMetadata: {
      groundingChunks: [{ retrievedContext: { uri: doc.fileSearchDocName } }, { retrievedContext: { uri: 'unknown-draft' } }], groundingSupports: [{ groundingChunkIndices: [0, 1] }],
    } },
  ];
  const runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-09', bindings: { GEMINI_API_KEY: 'offline-worker-key' },
    outboundService: async request => {
      assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
      assert.equal(request.method, 'POST'); assert.equal(request.headers.get('x-goog-api-key'), 'offline-worker-key');
      assert.ok(candidates.length, 'Unexpected outbound call');
      return Response.json({ candidates: [candidates.shift()] });
    },
  }));
  const client = new Client({ name: 'cloudflare-acceptance', version: '0.1' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL('https://mcp.example/mcp'), { fetch: (url, init) => runtime.dispatchFetch(String(url), init) }));
    const tools = await client.listTools(); assert.equal(tools.tools.length, 2);
    const answer = await client.callTool({ name: 'query_archive', arguments: { question: 'Q' } });
    assert.equal(answer.structuredContent.status, 'grounded'); assert.equal(answer.structuredContent.sources[0].id, doc.slug);
    const draft = await client.callTool({ name: 'query_archive', arguments: { question: 'Q' } });
    assert.equal(draft.structuredContent.status, 'no_supported_sources'); assert.doesNotMatch(JSON.stringify(draft), /draft text/);
    assert.equal(candidates.length, 0);
  } finally { await client.close(); await runtime.dispose(); }
});
