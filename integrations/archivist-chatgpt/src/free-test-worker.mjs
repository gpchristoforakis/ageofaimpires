import worker from './worker.mjs';

// Isolated hosting verification. Never pass a Gemini secret, including one
// accidentally added to this test Worker's environment.
export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/' && request.method === 'GET') {
      return Response.json({
        name: 'The Archivist Hosting Check',
        mode: 'free_plan_verification',
        queryEnabled: false,
        archiveConfigured: false,
      }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    return worker.fetch(request, { MCP_ALLOWED_ORIGINS: env.MCP_ALLOWED_ORIGINS });
  },
};
