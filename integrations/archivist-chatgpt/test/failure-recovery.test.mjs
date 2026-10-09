import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startServer } from '../src/server.mjs';
import { registry } from '../src/archive.mjs';

test('SDK reports provider outage without secret leakage and succeeds after recovery', async () => {
  let unavailable = true;
  let calls = 0;
  const doc = registry.find(row => row.slug === 'age-of-aimpires-entry-01');
  const server = await startServer({ port: 0, apiKey: 'outage-fixture-secret', delay: async () => {},
    fetchImpl: async () => {
      calls++;
      if (unavailable) return Response.json({ error: { message: 'outage-fixture-secret internal provider trace' } }, { status: 503 });
      return Response.json({ candidates: [{ content: { parts: [{ text: 'Entry #01 distinguishes stopping from completion.' }] },
        groundingMetadata: { groundingChunks: [{ retrievedContext: { uri: doc.fileSearchDocName, title: doc.title } }],
          groundingSupports: [{ groundingChunkIndices: [0] }] } }] });
    },
  });
  const client = new Client({ name: 'outage-recovery-test', version: '0.1.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`)));
    const failed = await client.callTool({ name: 'query_archive', arguments: { question: 'What is completion?' } });
    assert.equal(failed.isError, true);
    assert.equal(JSON.parse(failed.content[0].text).code, 'archive_unavailable');
    assert.doesNotMatch(JSON.stringify(failed), /outage-fixture-secret|internal provider trace/);
    assert.equal(calls, 3);
    unavailable = false;
    const recovered = await client.callTool({ name: 'query_archive', arguments: { question: 'What is completion?' } });
    assert.equal(recovered.structuredContent.status, 'grounded');
    assert.equal(recovered.structuredContent.sources[0].id, doc.slug);
    assert.equal(calls, 4);
  } finally {
    await client.close();
    server.close();
    await once(server, 'close');
  }
});
