import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { registry } from '../src/archive.mjs';

const endpoint = new URL('https://aoai-archivist-mcp.christoforakis.workers.dev');
const live = process.argv.includes('--live');
const health = await (await fetch(endpoint, { signal: AbortSignal.timeout(15000) })).json();
assert.equal(health.queryEnabled, live, 'Use --live only after intentionally activating the hosted archive.');
const report = { checkedAt: new Date().toISOString(), endpoint: endpoint.href, health, checks: [] };
const client = new Client({ name: 'archivist-public-check', version: '0.2.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', endpoint)));
  assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ['fetch_entry', 'query_archive']);
  const query = await client.callTool({ name: 'query_archive', arguments: { question: 'What is the Completion Boundary?' } }, undefined, { timeout: 65000 });
  if (live) {
    assert.equal(query.structuredContent?.status, 'grounded');
    report.query = query.structuredContent;
  } else {
    assert.equal(query.isError, true);
    assert.equal(JSON.parse(query.content[0].text).code, 'archive_unavailable');
    report.query = 'disabled';
  }
  for (const doc of registry) {
    const page = await client.callTool({ name: 'fetch_entry', arguments: { id: doc.slug } });
    const ok = page.structuredContent?.status === 'ok' && page.structuredContent.source.url === doc.canonicalUrl;
    report.checks.push({ id: doc.slug, ok });
  }
  assert.ok(report.checks.every(check => check.ok));
  console.log(`Hosted MCP: two tools; query ${live ? 'grounded' : 'disabled'}; ${report.checks.length}/${registry.length} pages passed.`);
} finally {
  await client.close();
  await writeFile(new URL('../artifacts/public-hosted-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
