const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { stripTypeScriptTypes } = require('node:module');
const { isDeepStrictEqual } = require('node:util');

const root = path.resolve(__dirname, '..');
const donor = process.env.ARCHIVIST_DONOR_PATH || path.join(root, '..', 'ageofaimpires-archivist');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const baselineRef = execFileSync('git', ['merge-base', 'HEAD', 'main'], { cwd: root, encoding: 'utf8' }).trim();
const base = file => execFileSync('git', ['show', `${baselineRef}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).replace(/\r\n/g, '\n');
const source = read('_worker.js');
const loadModule = code => import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

(async () => {
  const module = await loadModule(source + '\nexport { ARCHIVIST_SYSTEM_INSTRUCTION, ARCHIVIST_SOURCE_REGISTRY, mapArchivistSources };');
  const worker = module.default;
  const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));
  for (const page of pages) {
    assert.equal(read(page).replace(/\n<link rel="stylesheet" href="assets\/archivist\.css\?v=[a-f0-9]+">\n<script src="assets\/archivist\.js\?v=[a-f0-9]+" defer><\/script>\n/, ''), base(page), `Existing page content changed: ${page}`);
  }
  for (const name of ['handleContact', 'handleSubscribe']) {
    const pattern = new RegExp(`async function ${name}\\([\\s\\S]*?\\n}\\n`);
    assert.equal(source.match(pattern)[0], base('_worker.js').match(pattern)[0], `${name} changed`);
  }
  const runtime = read('assets/archivist.js');
  assert.doesNotMatch(runtime, /GEMINI_API_KEY|AIza[\w-]{20,}|getUserMedia|WebSocket|Librarian/i);
  assert.doesNotMatch(source, /import .*express|from ['"](?:node:)?fs|fileSearchStores\.create|uploadToFileSearchStore/);

  const fullRegistry = JSON.parse(fs.readFileSync(path.join(donor, 'data/document-registry.json'), 'utf8')).documents;
  const donorChat = fs.readFileSync(path.join(donor, 'server/chat.ts'), 'utf8').replace(/\r\n/g, '\n');
  const instruction = donorChat.match(/const ARCHIVIST_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/)[1];
  assert.equal(module.ARCHIVIST_SYSTEM_INSTRUCTION, instruction, 'Locked instructions must be identical');
  const fields = ['title', 'canonicalUrl', 'slug', 'pageType', 'publicationDate', 'sectionHeadings', 'fileSearchDocName', 'retrievalEligible'];
  assert.deepEqual(module.ARCHIVIST_SOURCE_REGISTRY, fullRegistry.filter(doc => doc.fileSearchDocName?.trim() && doc.retrievalEligible === true)
    .map(doc => Object.fromEntries(fields.map(key => [key, doc[key]]))), 'Source metadata changed');
  for (const name of ['archivist-portrait.jpg', 'archivist-idle.mp4']) {
    assert.deepEqual(fs.readFileSync(path.join(root, 'assets/archivist', name)), fs.readFileSync(path.join(donor, 'public/assets/archivist', name)));
  }

  // Execute the donor's actual typed chat function with mocked dependencies.
  // No donor module with filesystem or API side effects is imported.
  let donorFixture;
  global.__archivistDonorTest = {
    storeManager: { getOrCreateStore: async () => 'fileSearchStores/age-of-aimpires-archive-oygcx3s6yi3t', getRegistry: () => fullRegistry },
    ai: { models: { generateContent: async () => donorFixture } },
    withRetry: fn => fn(),
  };
  const donorModule = await loadModule('const {ai, withRetry, storeManager} = globalThis.__archivistDonorTest;\n' +
    stripTypeScriptTypes(donorChat.replace(/^import .*;\n/gm, ''), { mode: 'strip' }));
  const eligible = module.ARCHIVIST_SOURCE_REGISTRY;
  const supportedGrounding = contexts => ({
    groundingChunks: contexts.map(retrievedContext => ({ retrievedContext })),
    groundingSupports: contexts.map((_, index) => ({ groundingChunkIndices: [index],
      segment: { partIndex: 0, startIndex: 0, endIndex: 14, text: 'Fixture answer' } })),
  });
  const validContexts = eligible.flatMap(doc => [
    { title: doc.title, text: 'Retrieved publication passage' },
    { uri: doc.fileSearchDocName }, { title: doc.fileSearchDocName },
  ]);
  // Require correct document identity for supported fixtures. Compare donor output
  // separately so its shorter-title misattribution cannot become the expected result.
  const fixtures = validContexts.map(ctx => supportedGrounding([ctx]));
  fixtures.push(supportedGrounding(validContexts));
  const correctedFixtureIndices = [];
  for (const [fixtureIndex, groundingMetadata] of fixtures.entries()) {
    const expectedSources = new Map();
    for (const { retrievedContext: ctx } of groundingMetadata.groundingChunks) {
      const doc = eligible.find(row => ctx.uri === row.fileSearchDocName || ctx.title === row.fileSearchDocName || ctx.title === row.title);
      assert.ok(doc, 'Positive fixture must identify an exact known document');
      if (!expectedSources.has(doc.canonicalUrl)) expectedSources.set(doc.canonicalUrl, {
        title: doc.title, canonicalUrl: doc.canonicalUrl, slug: doc.slug,
        pageType: doc.pageType, publicationDate: doc.publicationDate,
        section: doc.sectionHeadings[0] || doc.pageType,
        snippet: ctx.text ? ctx.text.substring(0, 240) + '...' : undefined,
        fileSearchDocName: doc.fileSearchDocName,
      });
    }
    const actual = module.mapArchivistSources(groundingMetadata);
    assert.deepEqual(actual, [...expectedSources.values()], 'Valid supported source must map to the correct document');
    donorFixture = { text: 'Fixture answer', candidates: [{ groundingMetadata }] };
    const former = await donorModule.askArchivist([], 'Test');
    if (!isDeepStrictEqual(actual, former.sources)) correctedFixtureIndices.push(fixtureIndex);
  }
  // The exact Deep Dive title previously matched the shorter Framework title.
  // This also affected the first selected snippet in the aggregate fixture.
  assert.deepEqual(correctedFixtureIndices, [validContexts.findIndex(ctx => ctx.title === "The Effective Task Cost Framework: The Operator's Deep Dive"), fixtures.length - 1]);

  // A: Exact stable document identity plus answer support produces a source.
  const known = { uri: eligible[0].fileSearchDocName, title: eligible[0].title, text: 'Published passage' };
  const sourceA = module.mapArchivistSources(supportedGrounding([known]));
  assert.equal(sourceA.length, 1);
  assert.equal(sourceA[0].canonicalUrl, eligible[0].canonicalUrl);
  assert.equal(sourceA[0].fileSearchDocName, eligible[0].fileSearchDocName);

  // B: Retrieved documents not referenced by answer support remain private.
  assert.deepEqual(module.mapArchivistSources({ groundingChunks: [{ retrievedContext: known }] }), []);
  assert.deepEqual(module.mapArchivistSources({ groundingChunks: [{ retrievedContext: known }], groundingSupports: [] }), []);
  assert.deepEqual(module.mapArchivistSources({ groundingChunks: [{ retrievedContext: known }], groundingSupports: [{ groundingChunkIndices: [] }] }), []);
  const twoChunks = supportedGrounding([known, { uri: eligible[1].fileSearchDocName }]);
  twoChunks.groundingSupports = [{ groundingChunkIndices: [1] }];
  assert.deepEqual(module.mapArchivistSources(twoChunks).map(doc => doc.canonicalUrl), [eligible[1].canonicalUrl]);

  // D: Unknown identity is authoritative evidence against a title fallback.
  const unknownIdentity = 'fileSearchStores/age-of-aimpires-archive-oygcx3s6yi3t/documents/unknown';
  for (const ctx of [
    { uri: unknownIdentity, title: `Unlisted draft: ${eligible[0].title}`, text: eligible[0].title },
    { uri: unknownIdentity, title: eligible[0].title, text: eligible[0].sectionHeadings.join('\n') },
    { title: `Unlisted draft: ${eligible[0].title}`, text: eligible[0].title },
    { title: 'Unknown document', text: eligible[0].title + '\n' + eligible[0].sectionHeadings.join('\n') },
    { title: unknownIdentity, text: eligible[0].title },
  ]) assert.deepEqual(module.mapArchivistSources(supportedGrounding([ctx])), [], 'Unknown source must never borrow a known source card');
  const rejectedLegacyContexts = eligible.flatMap(doc => [
    { title: doc.slug }, { title: `Archive: ${doc.title}` },
    { text: doc.title }, ...doc.sectionHeadings.slice(0, 2).map(heading => ({ text: heading })),
  ]);
  for (const ctx of rejectedLegacyContexts) {
    assert.deepEqual(module.mapArchivistSources(supportedGrounding([ctx])), [], 'Former fuzzy fixture must now be omitted');
  }
  // Stable identity takes precedence over display title; conflicting identities fail closed.
  assert.equal(module.mapArchivistSources(supportedGrounding([{ uri: eligible[0].fileSearchDocName, title: eligible[1].title }]))[0].canonicalUrl, eligible[0].canonicalUrl);
  assert.deepEqual(module.mapArchivistSources(supportedGrounding([{ uri: eligible[0].fileSearchDocName, title: eligible[1].fileSearchDocName }])), []);
  assert.deepEqual(module.mapArchivistSources(supportedGrounding([{ ...known, fileSearchStore: 'fileSearchStores/other' }])), []);
  assert.equal(module.mapArchivistSources(supportedGrounding([{ ...known, fileSearchStore: 'fileSearchStores/age-of-aimpires-archive-oygcx3s6yi3t' }])).length, 1);
  for (const doc of fullRegistry.filter(doc => !doc.retrievalEligible)) {
    assert.deepEqual(module.mapArchivistSources(supportedGrounding([{ title: doc.title, uri: doc.fileSearchDocName || unknownIdentity }])), []);
  }

  // E: Repeated support references and different chunks from one document deduplicate.
  const repeated = supportedGrounding([known, { ...known, text: 'Another passage' }]);
  repeated.groundingSupports = [{ groundingChunkIndices: [0, 1] }, { groundingChunkIndices: [1, 0, 0] }];
  assert.deepEqual(module.mapArchivistSources(repeated), sourceA);

  // F: Invalid or out-of-range references cannot index another chunk or throw.
  const invalidIndices = [-1, 1, 999, 0.5, '0', null, false, {}, NaN, Infinity];
  assert.deepEqual(module.mapArchivistSources({ groundingChunks: [{ retrievedContext: known }],
    groundingSupports: [{ groundingChunkIndices: invalidIndices }] }), []);
  assert.deepEqual(module.mapArchivistSources({ groundingChunks: [{ retrievedContext: known }],
    groundingSupports: [null, {}, { groundingChunkIndices: '0' }, { groundingChunkIndices: [...invalidIndices, 0] }] }), sourceA);
  for (const malformed of [undefined, {}, { groundingChunks: {} }, { groundingSupports: {} },
    { groundingChunks: [], groundingSupports: [{ groundingChunkIndices: [0] }] },
    { groundingChunks: [null, { retrievedContext: null }, { retrievedContext: [] }, { retrievedContext: { uri: 5, title: eligible[0].title } }], groundingSupports: [{ groundingChunkIndices: [0, 1, 2, 3] }] },
    { groundingChunks: [{ web: { title: eligible[0].title } }], groundingSupports: [{ groundingChunkIndices: [0] }] },
  ]) assert.deepEqual(module.mapArchivistSources(malformed), []);

  const originalFetch = global.fetch;
  const originalTimeout = global.setTimeout;
  const calls = [];
  let replies = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options, payload: JSON.parse(options.body) });
    const next = replies.shift();
    assert.ok(next, 'Unexpected remote request');
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body || {}), { status: next.status || 200 });
  };
  const env = { GEMINI_API_KEY: 'fake-test-key', ASSETS: { fetch: async () => new Response('existing asset') } };
  const request = async (body, extra = {}, config = env) => {
    const response = await worker.fetch(new Request('https://ageofaimpires.com/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ageofaimpires.com', ...extra.headers },
      body: extra.raw ?? JSON.stringify(body),
    }), config);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await worker.fetch(new Request('https://ageofaimpires.com/api/chat'), env)).status, 405);
    for (const body of [null, [], {}, { query: '' }, { query: 42 }, { query: 'Q'.repeat(4001) },
      { query: 'Q', history: {} }, { query: 'Q', history: null }, { query: 'Q', history: Array(9).fill({ role: 'user', content: 'Q' }) },
      { query: 'Q', history: [null] }, { query: 'Q', history: [{ role: 'system', content: 'Q' }] },
      { query: 'Q', history: [{ role: 'user', content: 'X'.repeat(8001) }] },
      { query: 'Q', history: Array(8).fill({ role: 'model', content: 'X'.repeat(5000) }) },
      { query: 'Q', context: [] }, { query: 'Q', context: { unknown: 'Q' } },
      { query: 'Q', context: { constructor: 'Q' } }, { query: 'Q', context: { toString: 'Q' } },
      { query: 'Q', context: { current_url: 'https://other.example/private' } },
      { query: 'Q', context: { current_url: 'https://ageofaimpires.com:8443/private' } },
      { query: 'Q', context: { current_page: 'X'.repeat(301) } },
    ]) assert.equal((await request(body)).status, 400);
    assert.equal((await request({}, { raw: '{broken' })).status, 400);
    assert.equal((await request({}, { raw: 'X'.repeat(65537) })).status, 413);
    assert.equal((await request({}, { raw: JSON.stringify({ query: '日'.repeat(23000) }) })).status, 413);
    assert.equal((await request({ query: 'Q' }, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await request({ query: 'Q' }, { headers: { 'Content-Type': 'application/json-evil' } })).status, 415);
    assert.equal((await request({ query: 'Q' }, { headers: { Origin: 'https://other.example' } })).status, 403);
    assert.equal((await request({ query: 'Q' }, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal((await request({ query: 'Q' }, {}, { ASSETS: env.ASSETS })).status, 503);
    assert.equal(calls.length, 0, 'Invalid requests must not call Gemini');

    const groundingMetadata = supportedGrounding([known]);
    const reply = { candidates: [{ content: { parts: [{ text: 'Private reasoning', thought: true }, { text: 'Grounded ' }, { text: 'answer.' }] }, groundingMetadata }] };
    replies = [{ body: reply }];
    const history = [{ role: 'user', content: 'Earlier question' }, { role: 'model', content: 'Earlier answer' }];
    const context = { current_url: 'https://ageofaimpires.com/age-of-aimpires-entry-01', current_page: eligible[0].title, current_entry: 'Entry #01', current_section: 'Introduction', site_language: 'en-GB' };
    const response = await request({ query: '  Follow-up  ', history, context });
    assert.equal(response.status, 200);
    assert.equal(response.body.sources.length, 1, 'A: Supported known source must survive the API route');
    assert.deepEqual(response.body, { reply: 'Grounded answer.', sources: module.mapArchivistSources(groundingMetadata) });
    const call = calls.at(-1);
    assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    assert.equal(call.options.headers['x-goog-api-key'], 'fake-test-key');
    assert.ok(!call.url.includes('fake-test-key'));
    assert.equal(call.payload.systemInstruction.parts[0].text, instruction);
    assert.deepEqual(call.payload.tools, [{ fileSearch: { fileSearchStoreNames: ['fileSearchStores/age-of-aimpires-archive-oygcx3s6yi3t'] } }]);
    assert.equal(Object.hasOwn(call.payload, 'generationConfig'), false, 'Use model defaults without any generation overrides');
    assert.deepEqual(Object.keys(call.payload).sort(), ['contents', 'systemInstruction', 'tools']);
    assert.deepEqual(call.payload.contents.slice(0, 2), history.map(message => ({ role: message.role, parts: [{ text: message.content }] })));
    assert.equal(call.payload.contents.at(-1).parts[0].text, 'Follow-up');
    assert.match(call.payload.contents.at(-1).parts[1].text, /untrusted navigation metadata/);
    assert.ok(call.payload.contents.at(-1).parts[1].text.endsWith(JSON.stringify(context)));

    replies = [{ body: { candidates: [{ content: { parts: [{ text: 'Hello.' }] } }] } }];
    assert.deepEqual((await request({ query: 'Hello' })).body, { reply: 'Hello.', sources: [] });
    // C: Greeting with an incidental retrieved chunk but no answer support has no cards.
    for (const supports of [undefined, [], [{ groundingChunkIndices: [] }]]) {
      replies = [{ body: { candidates: [{ content: { parts: [{ text: 'Hello.' }] }, groundingMetadata: {
        groundingChunks: [{ retrievedContext: known }], ...(supports ? { groundingSupports: supports } : {}),
      } }] } }];
      assert.deepEqual((await request({ query: 'Hello' })).body, { reply: 'Hello.', sources: [] });
    }
    // An unknown supported document cannot produce a public card through the API either.
    replies = [{ body: { candidates: [{ content: { parts: [{ text: 'An answer.' }] },
      groundingMetadata: supportedGrounding([{ uri: unknownIdentity, title: eligible[0].title, text: eligible[0].title }]),
    }] } }];
    assert.deepEqual((await request({ query: 'Q' })).body.sources, []);
    replies = [{ body: { candidates: [{ content: { parts: [{ text: eligible[0].title }] } }] } }];
    assert.deepEqual((await request({ query: 'Q' })).body.sources, [], 'Answer text must never create citations');
    replies = [{ body: {} }];
    assert.equal((await request({ query: 'Q' })).status, 502);
    for (const next of [
      { status: 401, body: { error: { message: 'private key provider response' } } },
      { status: 429, body: { error: { message: 'RESOURCE_EXHAUSTED' } } },
      new Error('private-stack-data'), new SyntaxError('private-provider-json'),
      Object.assign(new Error('private-timeout'), { name: 'TimeoutError' }),
    ]) {
      replies = [next];
      const failure = await request({ query: 'Q' });
      assert.equal(failure.status, next.name === 'TimeoutError' ? 504 : 502);
      assert.doesNotMatch(JSON.stringify(failure.body), /private|fake-test-key|stack/i);
    }
    global.setTimeout = (fn, delay, ...args) => originalTimeout(fn, [2500, 5000].includes(delay) ? 0 : delay, ...args);
    replies = [{ status: 503 }, { status: 504 }, { body: reply }];
    const beforeRetry = calls.length;
    assert.equal((await request({ query: 'Q' })).status, 200);
    assert.equal(calls.length - beforeRetry, 3);

    assert.equal(await (await worker.fetch(new Request('https://ageofaimpires.com/how-to'), env)).text(), 'existing asset');
    for (const legacy of ['/articles', '/articles/', '/articles.html']) {
      const redirect = await worker.fetch(new Request(`https://ageofaimpires.com${legacy}?source=old`), env);
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.get('Location'), 'https://ageofaimpires.com/entries?source=old');
    }
    assert.equal((await worker.fetch(new Request('https://ageofaimpires.com/api/contact'), env)).status, 405);
    const contactEnv = { ...env, RESEND_API_KEY: 'fake-contact-key' };
    replies = [{ status: 200 }];
    const contact = await worker.fetch(new Request('https://ageofaimpires.com/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reader@example.com', message: 'Test contact' }),
    }), contactEnv);
    assert.deepEqual(await contact.json(), { ok: true });
    assert.equal(calls.at(-1).url, 'https://api.resend.com/emails');
    assert.equal(calls.at(-1).payload.reply_to, 'reader@example.com');
    console.log(`Passed: citation cases A-G; ${fixtures.length} supported deterministic fixtures (${fixtures.length - correctedFixtureIndices.length} unchanged donor outputs, ${correctedFixtureIndices.length} corrected Deep Dive/title-order fixtures); ${rejectedLegacyContexts.length} former fuzzy fixtures now rejected; ${pages.length} unchanged editorial pages; locked instructions, ${eligible.length} metadata records/assets; model-default payload, chat validation, safe failures/retries, contact and routing. All API calls mocked.`);
  } finally {
    global.fetch = originalFetch;
    global.setTimeout = originalTimeout;
    delete global.__archivistDonorTest;
  }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
