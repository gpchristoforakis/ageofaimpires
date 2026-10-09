import { createMcpHandler, RequestGuard } from './mcp.mjs';
const guard = new RequestGuard();
// Separate Worker; this entry point does not replace the publication Worker.
export default {
  fetch(request, env) {
    return createMcpHandler({ apiKey: env.GEMINI_API_KEY, guard,
      allowedOrigins: [new URL(request.url).origin, ...(env.MCP_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)],
    })(request);
  },
};
