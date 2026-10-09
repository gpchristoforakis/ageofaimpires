const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test, beforeEach, afterEach, mock } = require('node:test');
const { setImmediate: tick } = require('node:timers/promises');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const load = code => import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const voiceCode = fs.readFileSync(path.join(root, 'assets/archivist-voice.js'), 'utf8');
const token = 'auth_tokens/offline-ephemeral';
let Voice, config, worker, factoryPrototype, sockets, tracks, contexts, clients, fetched, runtime;
let media, tokenRequest, archiveRequest;

class AudioNode {
  disconnects = 0; stops = 0; onaudioprocess = null;
  connect() {} disconnect() { this.disconnects++; } start() {} stop() { this.stops++; }
}
class AudioContextFixture {
  sampleRate = 48000; currentTime = 1; state = 'running'; destination = {}; nodes = []; closes = 0;
  constructor(options = {}) { this.sampleRate = options.sampleRate || 48000; contexts.push(this); }
  async resume() { this.state = 'running'; }
  async close() { this.closes++; this.state = 'closed'; }
  node() { const node = new AudioNode(); this.nodes.push(node); return node; }
  createMediaStreamSource() { return this.node(); }
  createScriptProcessor() { return this.node(); }
  createBufferSource() { return this.node(); }
  createBuffer(_channels, length, rate) { const samples = new Float32Array(length); return { duration: length / rate, getChannelData: () => samples }; }
}
function stream() { const track = { readyState: 'live', stops: 0, stop() { this.readyState = 'ended'; this.stops++; } }; tracks.push(track); return { getTracks: () => [track] }; }
function client(callbacks = {}) { const value = new Voice(callbacks, runtime); clients.push(value); return value; }
async function opened(value) {
  const previousSockets = sockets.length;
  const starting = value.start();
  for (let i = 0; i < 30 && sockets.length === previousSockets; i++) await tick();
  assert.ok(sockets.length > previousSockets, 'SDK created a new tracked browser connection');
  return { starting, socket: sockets.at(-1) };
}
async function connected(value) { const { starting, socket } = await opened(value); socket.receive({ setupComplete: {} }); await starting; assert.equal(value.status, 'Connected'); return socket; }
function released(value) {
  assert.equal(value.stream, null); assert.equal(value.session, null); assert.equal(value.connection, null);
  assert.equal(value.audioSources.size, 0);
  assert.ok(tracks.every(track => track.readyState === 'ended' && track.stops === 1));
  assert.ok(contexts.every(context => context.state === 'closed' && context.closes === 1));
  assert.ok(sockets.every(socket => socket.closed));
}
function request(body = '{}', headers = {}, method = 'POST') {
  return new Request('https://preview.example/api/voice/token', { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(method === 'POST' ? { body } : {}) });
}

beforeEach(async () => {
  if (!Voice) {
    const module = await import('../assets/archivist-voice.js');
    Voice = module.ArchivistVoice; config = module.liveConfig;
    worker = (await load(fs.readFileSync(path.join(root, '_worker.js'), 'utf8'))).default;
    const { GoogleGenAI } = await import('../assets/vendor/google-genai-2.27.0.js');
    factoryPrototype = Object.getPrototypeOf(new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } }).live.webSocketFactory);
  }
  sockets = []; tracks = []; contexts = []; clients = []; fetched = [];
  media = async () => stream();
  tokenRequest = async () => Response.json({ token });
  archiveRequest = async () => Response.json({ reply: 'The grounded archive answer.', sources: [] });
  runtime = {
    isSecureContext: true, AudioContext: AudioContextFixture, setTimeout, clearTimeout,
    navigator: { mediaDevices: { getUserMedia: () => media() } },
    fetch: async (url, options) => {
      fetched.push({ url, body: options.body, signal: options.signal });
      if (url === '/api/voice/token') return tokenRequest();
      if (url === '/api/chat') return archiveRequest();
      throw new Error('Unexpected request');
    },
  };
  mock.method(factoryPrototype, 'create', (url, _headers, callbacks) => {
    const socket = {
      url, frames: [], closed: false,
      connect() { callbacks.onopen(new Event('open')); },
      send(text) { this.frames.push(JSON.parse(text)); },
      receive(message) { callbacks.onmessage(new MessageEvent('message', { data: JSON.stringify(message) })); },
      close() { if (this.closed) return; this.closed = true; callbacks.onclose({ code: 1000, reason: '' }); },
      gatewayClose() { this.closed = true; callbacks.onclose({ code: 1008, reason: 'offline failure' }); },
      error() { callbacks.onerror(new Event('error')); },
    };
    sockets.push(socket); return socket;
  });
});
afterEach(() => { clients.forEach(value => value.stop()); mock.restoreAll(); });

test('Worker mints one-use v1alpha token with donor expiries and never returns permanent key or extra provider fields', async () => {
  const permanent = 'server-only-test-credential'; let outbound;
  mock.method(globalThis, 'fetch', async (url, options) => { outbound = { url, ...options }; return Response.json({ name: token, unexpectedSecret: permanent }); });
  const before = Date.now();
  const response = await worker.fetch(request(), { GEMINI_API_KEY: permanent });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { token });
  assert.equal(outbound.url, 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens');
  assert.equal(outbound.headers['x-goog-api-key'], permanent);
  const body = JSON.parse(outbound.body);
  assert.deepEqual(Object.keys(body).sort(), ['expireTime', 'newSessionExpireTime', 'uses']);
  assert.equal(body.uses, 1);
  assert.ok(Math.abs(Date.parse(body.expireTime) - before - 1800000) < 1000);
  assert.ok(Math.abs(Date.parse(body.newSessionExpireTime) - before - 120000) < 1000);
});
test('Worker rejects method, cross-site origin, invalid JSON, overrides and oversized token requests', async () => {
  let calls = 0; mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('must not mint'); });
  for (const [req, status] of [[request('', {}, 'GET'),405], [request('{}',{Origin:'https://other.example'}),403],
    [request('{}',{'Sec-Fetch-Site':'cross-site'}),403], [request('{}',{'Content-Type':'text/plain'}),415],
    [request('{'),400], [request('[]'),400], [request('{"uses":999}'),400], [request(' '.repeat(1025)),413]]) {
    assert.equal((await worker.fetch(req, { GEMINI_API_KEY:'offline-key' })).status, status);
  }
  assert.equal(calls, 0);
});
test('Worker missing Preview secret is explicit and does not call Gemini', async () => {
  const response = await worker.fetch(request(), {}); assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'voice_not_configured');
});
test('Worker provider errors and malformed responses are sanitized without adding retries', async () => {
  for (const response of [new Response('offline-private-provider-details', {status:429}), Response.json({name:'permanent-key'}), new Response('invalid JSON')]) {
    let calls = 0; mock.method(globalThis, 'fetch', async () => { calls++; return response; });
    const result = await worker.fetch(request(), {GEMINI_API_KEY:'offline-key'});
    assert.equal(result.status, 502); assert.doesNotMatch(await result.text(), /offline-private|permanent-key|offline-key/);
    assert.equal(calls, 1); mock.restoreAll();
  }
});
test('Worker timeout is safe structured JSON', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new DOMException('private provider data', 'TimeoutError'); });
  const response = await worker.fetch(request(), {GEMINI_API_KEY:'offline-key'});
  assert.equal(response.status, 504); assert.equal((await response.json()).code, 'voice_timeout');
});
test('constructing a voice controller does not request microphone or token', () => {
  client(); assert.equal(tracks.length, 0); assert.equal(fetched.length, 0); assert.equal(contexts.length, 0);
});
test('real SDK serializer preserves model, Aoede, v1alpha auth route and no PCM before setupComplete', async () => {
  const value = client(); const {starting,socket} = await opened(value);
  assert.equal(value.status,'Connecting'); assert.equal(contexts.length,1);
  const url = new URL(socket.url);
  assert.equal(url.pathname,'//ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained');
  assert.deepEqual([...url.searchParams.keys()],['access_token']);
  const setup = socket.frames[0].setup;
  assert.equal(setup.model,'models/gemini-3.8-live');
  assert.deepEqual(setup.generationConfig,{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Aoede'}}}});
  assert.deepEqual(setup.inputAudioTranscription,{}); assert.deepEqual(setup.outputAudioTranscription,{});
  assert.equal(setup.tools[0].functionDeclarations[0].name,'queryArchive');
  assert.equal(value.processor,undefined);
  socket.receive({setupComplete:{}}); await starting;
  value.processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096).fill(0.1)}});
  assert.equal(socket.frames.at(-1).realtimeInput.audio.mimeType,'audio/pcm;rate=16000');
  assert.ok(socket.frames.at(-1).realtimeInput.audio.data.length);
});
test('End Voice closes microphone, processor, contexts, queued audio and connection idempotently', async () => {
  const value=client(); const socket=await connected(value); const processor=value.processor;
  socket.receive({serverContent:{modelTurn:{parts:[{inlineData:{data:'AAAAAA=='}}]}}}); await tick();
  const playback=[...value.audioSources][0];
  value.stop(); value.stop(); released(value);
  assert.equal(processor.onaudioprocess,null); assert.equal(playback.stops,1);
  assert.equal(value.status,'Disconnected');
});
test('cancellation while microphone permission is pending stops the eventually granted track', async () => {
  let resolve; media=()=>new Promise(r=>{resolve=r;});
  const value=client(); const starting=value.start(); value.stop(); resolve(stream()); await starting;
  released(value); assert.equal(fetched.length,0); assert.equal(sockets.length,0);
});
test('cancellation while token mint is pending aborts request and cannot open a late socket', async () => {
  let resolve; tokenRequest=()=>new Promise(r=>{resolve=r;});
  const value=client(); const starting=value.start(); for(let i=0;i<30&&!resolve;i++)await tick();
  value.stop(); assert.equal(fetched[0].signal.aborted,true); resolve(Response.json({token})); await starting;
  released(value); assert.equal(sockets.length,0);
});
test('End Voice while connecting closes pending transport; a late acknowledgement cannot revive capture', async () => {
  const value=client(); const {starting,socket}=await opened(value); value.stop(); await starting;
  socket.receive({setupComplete:{}}); await tick(); released(value); assert.equal(contexts.length,1);
});
test('gateway close and error before setupComplete release every resource and settle startup', async () => {
  for(const method of ['gatewayClose','error']) {
    const value=client(); const {starting,socket}=await opened(value); socket[method](); await starting;
    assert.equal(value.status,'Error'); released(value); sockets=[];tracks=[];contexts=[];clients=[];
  }
});
test('token failure safely releases microphone and output context', async () => {
  tokenRequest=async()=>Response.json({error:'do not expose'}, {status:500}); const value=client(); await value.start();
  assert.equal(value.status,'Error'); released(value);
});
test('unsupported browser never requests microphone', async () => {
  runtime.isSecureContext=false; const value=client(); await value.start(); assert.equal(value.status,'Error'); assert.equal(tracks.length,0);
});
test('inactivity closes mic/socket/audio after three minutes; startup timeout also closes pending handshake', async context => {
  context.mock.timers.enable({apis:['setTimeout']}); runtime.setTimeout=setTimeout; runtime.clearTimeout=clearTimeout;
  const value=client(); await connected(value);
  context.mock.timers.tick(179999); assert.equal(value.status,'Connected');
  context.mock.timers.tick(1); assert.equal(value.status,'Disconnected'); released(value);
});
test('handshake timeout releases pending resources without marking Connected', async context => {
  context.mock.timers.enable({apis:['setTimeout']}); runtime.setTimeout=setTimeout;runtime.clearTimeout=clearTimeout;
  const value=client(); const {starting}=await opened(value);context.mock.timers.tick(30000);await starting;
  assert.equal(value.status,'Error');released(value);
});
test('queryArchive calls only production /api/chat and returns its answer; cards only use backend sources', async () => {
  const sources=[{title:'Known published source',canonicalUrl:'https://ageofaimpires.com/framework-effective-task-cost'}];
  archiveRequest=async()=>Response.json({reply:'The Completion Boundary is the usable finish.',sources});
  const transcripts=[];const value=client({onTranscript:event=>transcripts.push(event),pageContext:()=>({current_entry:'Entry #01'})});
  const socket=await connected(value);
  socket.receive({toolCall:{functionCalls:[{name:'queryArchive',id:'lookup',args:{query:'What is the Completion Boundary?'}}]}});await tick();
  assert.deepEqual(JSON.parse(fetched.find(f=>f.url==='/api/chat').body),{query:'What is the Completion Boundary?',history:[],context:{current_entry:'Entry #01'}});
  assert.deepEqual(socket.frames.at(-1).toolResponse.functionResponses,[{name:'queryArchive',id:'lookup',response:{output:'The Completion Boundary is the usable finish.'}}]);
  socket.receive({serverContent:{inputTranscription:{text:'Question'},outputTranscription:{text:'Grounded answer'},turnComplete:true}});await tick();
  assert.deepEqual(transcripts.find(t=>t.role==='model'&&t.isFinal).sources,sources);
  socket.receive({serverContent:{outputTranscription:{text:'Hello'},turnComplete:true}});await tick();
  assert.deepEqual(transcripts.at(-1).sources,[],'phatic turn cannot inherit prior cards');
});
test('archive failure preserves limitation and supplies no guessed sources', async () => {
  archiveRequest=async()=>Response.json({error:'upstream quota'}, {status:502});const value=client();const socket=await connected(value);
  socket.receive({toolCall:{functionCalls:[{name:'queryArchive',id:'lookup',args:{query:'AGI'}}]}});await tick();
  assert.equal(socket.frames.at(-1).toolResponse.functionResponses[0].response.output,"I couldn't reach the archive just now.");
  assert.deepEqual(value.sources,[]);
});
test('late archive response after End Voice cannot leak to a new session', async () => {
  let resolve;archiveRequest=()=>new Promise(r=>{resolve=r;});const value=client();const old=await connected(value);
  old.receive({toolCall:{functionCalls:[{name:'queryArchive',id:'old',args:{query:'Old'}}]}});await tick();value.stop();
  const next=await connected(value);resolve(Response.json({reply:'stale',sources:[{title:'stale'}]}));await tick();
  assert.equal(next.frames.some(f=>f.toolResponse),false);assert.deepEqual(value.sources,[]);
});
test('local speech and server interruption stop queued playback while keeping capture available', async () => {
  const value=client();const socket=await connected(value);socket.receive({serverContent:{modelTurn:{parts:[{inlineData:{data:'AAAAAA=='}}]}}});await tick();
  const first=[...value.audioSources][0];value.processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096).fill(0.1)}});
  assert.equal(first.stops,1);assert.equal(value.status,'Connected');
  socket.receive({serverContent:{modelTurn:{parts:[{inlineData:{data:'AAAAAA=='}}]}}});await tick();const second=[...value.audioSources][0];
  socket.receive({serverContent:{interrupted:true}});await tick();assert.equal(second.stops,1);assert.equal(value.stream.getTracks()[0].readyState,'live');
});
test('locked donor instructions/config port, ordinary WebSocket and pagehide cleanup are preserved', () => {
  const donor=process.env.ARCHIVIST_DONOR_PATH; assert.ok(donor,'Set ARCHIVIST_DONOR_PATH for checkpoint comparison');
  const donorCode=execFileSync('git',['show','b9af7bf9fab676ec042615d88d9770468e7c1d28:src/services/archivistVoiceClient.ts'],{cwd:donor,encoding:'utf8'});
  assert.equal(config().systemInstruction,donorCode.match(/export const ARCHIVIST_LIVE_SYSTEM_INSTRUCTION = `([\s\S]*?)`;/)[1]);
  assert.doesNotMatch(voiceCode,/ProxiedWebSocket|createElement\(['"]iframe|Object\.defineProperty\(globalThis/);
  const main=fs.readFileSync(path.join(root,'assets/archivist.js'),'utf8');assert.match(main,/addEventListener\('pagehide', stopVoice\)/);
  assert.doesNotMatch(main,/GEMINI_API_KEY|AIza[\w-]{20,}/);assert.doesNotMatch(voiceCode,/GEMINI_API_KEY|AIza[\w-]{20,}/);
});
