import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Local review only. Never serves credentials or invokes publication APIs.
const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const baseline = execFileSync('git', ['show', 'HEAD:about.html'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const route = decodeURIComponent(url.pathname);
    if (request.method !== 'GET' || !(/^\/(about(?:\.html)?|assets\/[\w./-]+|media\/[\w./-]+)$/.test(route))) {
      response.writeHead(404).end(); return;
    }
    const file = path.resolve(root, '.' + (route === '/about' ? '/about.html' : route));
    if (!file.startsWith(root + path.sep)) { response.writeHead(404).end(); return; }
    let body = file.endsWith('about.html') && url.searchParams.get('variant') === 'before' ? baseline : await readFile(file);
    if (file.endsWith('about.html')) {
      const theme = url.searchParams.get('theme');
      // A preview-only switch permits deterministic visual comparison of both
      // themes. It is never saved in about.html or included in a site release.
      if (theme === 'light' || theme === 'dark') body = String(body).replace('<head>', `<head><script>localStorage.setItem('ageofaimpires:theme:v1','${theme}')</script>`);
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
});
server.listen(8797, '127.0.0.1', () => console.log('About review: http://127.0.0.1:8797/about.html?theme=light'));
