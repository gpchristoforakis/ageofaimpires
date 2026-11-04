// Local preview only: in-memory comments, no email, subscriptions, voice or archive API calls.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
module.exports = async (port = 0) => {
  const root = path.resolve(__dirname, '..');
  const {handleComments} = await import(pathToFileURL(path.join(root, 'lib/comments.mjs')));
  const db = require('./comments-test-db.cjs')();
  const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.m4a':'audio/mp4', '.mp4':'video/mp4', '.ogg':'audio/ogg'};
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://' + req.headers.host);
      if (url.pathname === '/api/comments') {
        const parts = [];
        let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 16000) {res.writeHead(413).end();return;} parts.push(chunk); }
        const headers = new Headers(req.headers);
        headers.set('CF-Connecting-IP', '127.0.0.1');
        const response = await handleComments(new Request(url, {method:req.method, headers,
          ...(['GET','HEAD'].includes(req.method) ? {} : {body:Buffer.concat(parts)})}),
          {COMMENTS_DB:db, COMMENTS_RATE_SECRET:'local-preview-only'});
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
        return;
      }
      if (url.pathname.startsWith('/api/')) {res.writeHead(503).end('Local preview: API unavailable');return;}
      let name = decodeURIComponent(url.pathname);
      if (name === '/') name = '/index.html';
      if (!path.extname(name)) name += '.html';
      const file = path.resolve(root, '.' + name);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404).end();return;}
      res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
      fs.createReadStream(file).pipe(res);
    } catch {res.writeHead(500).end('Local preview error');}
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return {server, db, url:'http://127.0.0.1:' + server.address().port};
};
if (require.main === module) module.exports(Number(process.argv[2] || 49855)).then(({url}) => console.log('Local comments preview (data resets on restart): ' + url));
