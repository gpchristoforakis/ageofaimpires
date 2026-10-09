import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../_worker.js';
test('publication does not serve new server modules or prototype sources as static assets', async () => {
  let assets = 0;
  const env = { ASSETS: { fetch: async () => { assets++; return new Response('Published asset'); } } };
  for (const path of ['/lib/archivist-core.mjs', '/lib%2farchivist-core.mjs', '/%2flib/archivist-core.mjs', '/integrations/archivist-chatgpt/package.json', '/integrations/archivist-chatgpt/src/archive.mjs']) {
    const response = await worker.fetch(new Request('https://ageofaimpires.com' + path), env);
    assert.equal(response.status, 404); assert.equal(await response.text(), 'Not Found');
  }
  assert.equal(assets, 0);
  for (const path of ['/', '/assets/site-theme.js', '/age-of-aimpires-entry-01']) assert.equal(await (await worker.fetch(new Request('https://ageofaimpires.com' + path), env)).text(), 'Published asset');
  assert.equal(assets, 3);
});
