import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { startServer } from '../src/server.mjs';
import { demoGeminiFetch } from '../src/demo.mjs';
import { registry } from '../src/archive.mjs';

let apiKey = process.env.GEMINI_API_KEY;
// Optional explicit credential path; read only the Gemini variable into memory.
if (process.env.ARCHIVIST_ENV_FILE) apiKey = parseEnv(await readFile(process.env.ARCHIVIST_ENV_FILE, 'utf8')).GEMINI_API_KEY;
const live = process.argv.includes('--live');
if (live && !apiKey) throw new Error('Live query needs GEMINI_API_KEY or ARCHIVIST_ENV_FILE. No credential values are logged.');
const remote = process.env.MCP_SMOKE_URL;
const server = remote ? null : await startServer({ port: 0, apiKey: live ? apiKey : 'demo-fixture-key',
  ...(live ? {} : { demo: true, fetchImpl: demoGeminiFetch, entryFetchImpl: globalThis.fetch }),
});
const url = remote ?? `http://127.0.0.1:${server.address().port}/mcp`;
const client = new Client({ name: 'archivist-smoke', version: '0.1' });
const report = { recorded_at: new Date().toISOString(), mode: live ? 'live' : 'query_fixture_with_live_entry_fetch', transport: remote ? 'configured_endpoint' : 'local_http', checks: [] };
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const tools = await client.listTools();
  report.tools = tools.tools.map(tool => tool.name);
  const started = performance.now();
  const result = await client.callTool({ name: 'query_archive', arguments: { question: 'What is the Completion Boundary?' } }, undefined, { timeout: 65000 });
  report.query = { duration_ms: Math.round(performance.now() - started), result };
  for (const doc of registry) {
    const begin = performance.now();
    const entry = await client.callTool({ name: 'fetch_entry', arguments: { id: doc.slug } }, undefined, { timeout: 25000 });
    report.checks.push({ id: doc.slug, duration_ms: Math.round(performance.now() - begin), success: !entry.isError,
      ...(entry.isError ? { error: JSON.parse(entry.content[0].text) } : { characters: entry.structuredContent.text.length, sections: entry.structuredContent.sections.length, url: entry.structuredContent.source.url }),
    });
    if (doc.slug === 'age-of-aimpires-entry-01' && !entry.isError) report.fetched_sample = entry.structuredContent;
  }
  const output = path.resolve(process.env.ARCHIVIST_OUTPUT_DIR ?? 'artifacts');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, live ? 'live-smoke.json' : 'demo-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Discovered ${report.tools.join(', ')}. Query: ${result.isError ? 'safe error' : result.structuredContent.status}. Published entries fetched: ${report.checks.filter(check => check.success).length}/${registry.length}.`);
  if (result.isError || report.checks.some(check => !check.success)) process.exitCode = 1;
} finally { await client.close(); if (server) await new Promise(resolve => server.close(resolve)); }
