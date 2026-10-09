import { createMcpHandler, RequestGuard } from './mcp.mjs';
import { budgetedGeminiFetch, DAILY_QUERY_LIMIT, MONTHLY_QUERY_LIMIT } from './query-budget.mjs';
export { ArchiveQueryBudget } from './query-budget.mjs';

const guard = new RequestGuard();
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const configured = Boolean(env.GEMINI_API_KEY && env.ARCHIVIST_QUERY_BUDGET);
    const enabled = env.ARCHIVIST_QUERY_ENABLED === 'true' && configured;
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({ name: 'The Archivist MCP', version: '0.2.0',
        mode: enabled ? 'live' : 'awaiting_activation', queryEnabled: enabled,
        archiveConfigured: configured, providerAttemptsPerDay: DAILY_QUERY_LIMIT,
        providerAttemptsPerMonth: MONTHLY_QUERY_LIMIT, budgetTimezone: 'UTC',
      }, { headers });
    }
    // The submission portal supplies this non-secret domain-verification token.
    if (request.method === 'GET' && url.pathname === '/.well-known/openai-apps-challenge' &&
        typeof env.OPENAI_APPS_CHALLENGE === 'string' && env.OPENAI_APPS_CHALLENGE.trim()) {
      return new Response(env.OPENAI_APPS_CHALLENGE.trim(), { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return createMcpHandler({ apiKey: enabled ? env.GEMINI_API_KEY : undefined, guard,
      fetchImpl: budgetedGeminiFetch(env.ARCHIVIST_QUERY_BUDGET), entryFetchImpl: globalThis.fetch,
      allowedOrigins: [url.origin, ...(env.MCP_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)],
    })(request);
  },
};
