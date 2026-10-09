import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

test('hosting-check Worker disables Gemini even if a secret is accidentally bound', async () => {
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/free-test-worker.mjs', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
  const html = await readFile(new URL('../../../about.html', import.meta.url), 'utf8');
  const outbound = [];
  const runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-09', bindings: { GEMINI_API_KEY: 'must-never-be-used' },
    outboundService: request => {
      outbound.push(request.url);
      assert.equal(request.url, 'https://ageofaimpires.com/about');
      assert.equal(request.headers.get('x-goog-api-key'), null);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
  }));
  const client = new Client({ name: 'free-hosting-acceptance', version: '0.1' });
  try {
    const health = await (await runtime.dispatchFetch('https://mcp.example/')).json();
    assert.equal(health.mode, 'free_plan_verification');
    assert.equal(health.queryEnabled, false);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://mcp.example/mcp'), { fetch: (url, init) => runtime.dispatchFetch(String(url), init) }));
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ['fetch_entry', 'query_archive']);
    const disabled = await client.callTool({ name: 'query_archive', arguments: { question: 'Explain effective task cost.' } });
    assert.equal(disabled.isError, true);
    assert.equal(JSON.parse(disabled.content[0].text).code, 'archive_unavailable');
    assert.deepEqual(outbound, [], 'Disabled query must make no provider request');
    const entry = await client.callTool({ name: 'fetch_entry', arguments: { id: 'about' } });
    assert.equal(entry.structuredContent.status, 'ok');
    assert.equal(entry.structuredContent.source.id, 'about');
    assert.deepEqual(outbound, ['https://ageofaimpires.com/about']);
    assert.doesNotMatch(JSON.stringify(entry), /must-never-be-used/);
  } finally { await client.close(); await runtime.dispose(); }
});
