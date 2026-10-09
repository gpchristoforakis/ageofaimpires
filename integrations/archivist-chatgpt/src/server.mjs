import http from 'node:http';
import { Readable } from 'node:stream';
import { createMcpHandler } from './mcp.mjs';

export function startServer(options = {}) {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8787;
  let handler;
  const server = http.createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const actualPort = server.address().port;
      if (!handler) handler = createMcpHandler({ ...options,
        allowedHosts: [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`, ...(options.allowedHosts ?? [])],
        allowedOrigins: [`http://127.0.0.1:${actualPort}`, `http://localhost:${actualPort}`, ...(options.allowedOrigins ?? [])],
      });
      const authority = req.headers.host ?? `${host}:${actualPort}`;
      const request = new Request(`http://${authority}${req.url}`, { method: req.method, headers: req.headers, signal: controller.signal,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: 'half' }),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
    } catch { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Request failed.'); }
  });
  server.requestTimeout = 70000; server.headersTimeout = 10000;
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server)); });
}
