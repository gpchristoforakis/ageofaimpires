import { startServer } from './server.mjs';
import { demoGeminiFetch } from './demo.mjs';
const demo = process.argv.includes('--demo');
const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
const server = await startServer({ port, apiKey: demo ? 'demo-fixture-key' : process.env.GEMINI_API_KEY,
  ...(demo ? { demo: true, fetchImpl: demoGeminiFetch, entryFetchImpl: globalThis.fetch } : {}),
  allowedOrigins: (process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
});
console.log(`The Archivist MCP: http://127.0.0.1:${port}/mcp`);
console.log(demo ? 'DEMO: simulated archive query; live published entry fetching.' : `Live mode. Archive credentials: ${process.env.GEMINI_API_KEY ? 'configured' : 'not configured'}.`);
const stop = () => server.close(() => process.exit(0));
process.once('SIGINT', stop); process.once('SIGTERM', stop);
