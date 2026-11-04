const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const {handleComments, commentPages} = await import(pathToFileURL(path.join(__dirname, '../lib/comments.mjs')));
  const db = require('./comments-test-db.cjs')();
  const env = {COMMENTS_DB: db, COMMENTS_RATE_SECRET: 'private-test-secret'};
  const base = 'https://example.test/api/comments';
  const payload = () => ({page:'/notebook.html', name:'Reader', comment:'A useful example.', consent:true, requestId:crypto.randomUUID()});
  const post = (body = payload(), overrides = {}, config = env) => handleComments(new Request(base, {
    method:'POST', headers:{Origin:'https://example.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1', ...overrides}, body:JSON.stringify(body),
  }), config);
  const get = (page = '/notebook', after = 0) => handleComments(new Request(base + '?page=' + encodeURIComponent(page) + '&after=' + after), env);
  assert.equal((await post(payload(), {}, {})).status, 503);
  assert.equal((await post(payload(), {}, {COMMENTS_DB:db})).status, 503);
  assert.equal((await post(payload(), {Origin:'https://other.test'})).status, 403);
  assert.equal((await post(payload(), {'Content-Type':'text/plain'})).status, 415);
  for (const body of [null, [], {...payload(), name:''}, {...payload(), comment:''}, {...payload(), consent:false}, {...payload(), name:'a'.repeat(81)}, {...payload(), comment:'x'.repeat(3001)}, {...payload(), page:'/unknown'}, {...payload(), requestId:'bad'}]) assert.equal((await post(body)).status, 400);
  assert.equal((await post({...payload(), comment:'x'.repeat(17000)})).status, 413);
  assert.equal((await post({...payload(), website:'spam'})).status, 202);
  assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM comments').get().n, 0);
  const first = {...payload(), name:'<img src=x onerror=alert(1)>', comment:'<script>alert(1)</script>\nText'};
  assert.equal((await post(first)).status, 202);
  assert.equal((await post(first)).status, 202);
  assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM comments').get().n, 1, 'retry must not duplicate');
  assert.equal((await (await get()).json()).comments.length, 1, 'comments publish immediately');
  const published = (await (await get('/notebook.html')).json()).comments;
  assert.equal(published[0].name, first.name);
  assert.deepEqual(Object.keys(published[0]).sort(), ['comment','created_at','id','name']);
  assert.deepEqual((await (await get('/about')).json()).comments, []);
  for (let i=0; i<3; i++) assert.equal((await post()).status, 202);
  assert.equal((await post()).status, 429);
  assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM comments').get().n, 4);
  assert.equal((await post(payload(), {'CF-Connecting-IP':'192.0.2.2'})).status, 202);
  for (let i=0;i<24;i++) db.sql.prepare("INSERT INTO comments(request_id,page,name,comment,created_at) VALUES(?, '/notebook', 'Reader', 'Text', ?)").run(crypto.randomUUID(),Date.now());
  const page1=await (await get()).json(), page2=await (await get('/notebook',page1.next)).json();
  assert.equal(page1.comments.length,20); assert.equal(page2.comments.length,9); assert.equal(page2.next,null);
  assert.equal(new Set([...page1.comments,...page2.comments].map(c=>c.id)).size,29);
  assert.equal((await get('/unknown')).status,400);
  assert.equal((await get('/notebook',-1)).status,400);
  for(const page of commentPages) {
    const file=page==='/'?'index.html':page.slice(1)+'.html';
    assert.ok(fs.readFileSync(path.join(__dirname,'..',file),'utf8').includes('data-comments="'+page+'"'),file);
  }
  db.sql.close();
  console.log('Passed: real SQLite submission, immediate publication, consent, validation, origin, idempotency, spam limits, pagination and all 19 page mounts.');
})().catch(error=>{console.error(error);process.exitCode=1;});
