// Port of donor b9af7bf: ordinary SDK browser transport; no AI Studio proxy adapter.
export const LIVE_MODEL = 'gemini-3.8-live';
export const LIVE_SYSTEM_INSTRUCTION = "You are The Archivist, the conversational voice guide to Age of AImpires (published at ageofaimpires.com).\n\nCRITICAL GROUNDING DIRECTIVE:\nYou do NOT independently possess knowledge of what the publication says. You must never answer publication-specific questions from your own training data or intuition.\n\nMANDATORY TOOL USE:\nFor ANY question or reference concerning:\n- Age of AImpires\n- George Christoforakis (in this publication, any question mentioning \"George\" refers to George Christoforakis; do NOT ask the user which George they mean)\n- Published entries, frameworks, how-to guides, or Notebook notes\n- Named publication concepts (such as The Completion Boundary, Effective Task Cost, Interaction Cost, Expansion Cost, Answer-Filter-Park)\n- Comparisons or relationships between published concepts or ideas\n- Any question asking what George believes, thinks, predicts, or has written\nYou MUST call the tool queryArchive(query: string) before answering. Do not synthesize or speak an answer prior to receiving the tool result.\n\nGROUNDING FIDELITY & ATTRIBUTION:\n1. The tool result from queryArchive is the sole authoritative source of truth.\n2. Speak the grounded answer faithfully, naturally, and concisely for voice conversation.\n3. Preserve all canonical named concepts identified in the tool result.\n4. If queryArchive states that the archive does not support a claim, does not contain a position, or has not addressed a topic, you MUST preserve that uncertainty and say so directly. Never convert an unsupported claim into a supported claim or invent a position.\n5. Never invent or attribute any opinion, view, or timeline to George Christoforakis unless explicitly present in the queryArchive output.\n6. Never generate, mention, or fabricate URLs, citations, or section anchors yourself; sources are surfaced automatically in the interface.\n\nCASUAL CONVERSATIONAL TURNS:\nFor simple phatic or operational turns unrelated to publication content (e.g. \"Hello, can you hear me?\", \"Are you there?\", \"Goodbye\", \"Can you repeat that?\"), you may respond naturally and concisely without calling queryArchive.";

export function liveConfig() {
  return {
    responseModalities: ['AUDIO'], systemInstruction: LIVE_SYSTEM_INSTRUCTION,
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
    tools: [{ functionDeclarations: [{
      name: 'queryArchive',
      description: 'Queries the authoritative Age of AImpires archive for published entries, frameworks, guides, notebook notes, and concepts.',
      parameters: { type: 'OBJECT', properties: { query: { type: 'STRING',
        description: "The search query to look up in the published Age of AImpires archive, preserving the visitor's request faithfully." } }, required: ['query'] },
    }] }],
    outputAudioTranscription: {}, inputAudioTranscription: {}, sessionResumption: {},
  };
}

function encodePCM(input) {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodePCM(data) {
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

export class ArchivistVoice {
  constructor(callbacks = {}, runtime = globalThis, loadSDK = () => import('./vendor/google-genai-2.27.0.js')) {
    this.callbacks = callbacks;
    this.runtime = runtime;
    this.loadSDK = loadSDK;
    this.status = 'Ready';
    this.generation = 0;
    this.sources = [];
    this.inputText = '';
    this.outputText = '';
    this.audioSources = new Set();
    this.nextPlaybackTime = 0;
    this.pendingRequests = new Set();
  }

  setStatus(status, error = '') {
    this.status = status;
    this.callbacks.onStatus?.(status, error);
  }

  setState(state) { this.callbacks.onState?.(state); }

  resetInactivity() {
    this.runtime.clearTimeout(this.inactivityTimer);
    if (this.status === 'Connecting' || this.status === 'Connected') {
      this.inactivityTimer = this.runtime.setTimeout(() => this.stop('Voice session ended after inactivity.'), 180000);
    }
  }

  async start() {
    if (this.status === 'Connecting' || this.status === 'Connected') return;
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.sources = [];
    this.inputText = '';
    this.outputText = '';
    this.setStatus('Connecting');
    this.setState('idle');
    try {
      if (!this.runtime.isSecureContext || !this.runtime.navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Voice needs a secure browser with microphone support.');
      }
      const AudioContext = this.runtime.AudioContext || this.runtime.webkitAudioContext;
      if (!AudioContext) throw new Error('Audio playback is unavailable in this browser.');
      // Called only by Start Voice. Resume playback in the user-action call stack.
      this.outputContext = new AudioContext({ sampleRate: 24000 });
      const resume = this.outputContext.resume();
      void resume.catch(() => {});
      const stream = await this.runtime.navigator.mediaDevices.getUserMedia({ audio: {
        channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      } });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      this.callbacks.onMicrophone?.(true);
      await resume;
      if (!current()) return;
      const { GoogleGenAI } = await this.loadSDK();
      if (!current()) return;
      const controller = new AbortController();
      this.pendingRequests.add(controller);
      const tokenResponse = await this.runtime.fetch('/api/voice/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      if (!current()) return;
      const tokenData = await tokenResponse.json();
      this.pendingRequests.delete(controller);
      if (!current()) return;
      if (!tokenResponse.ok || typeof tokenData.token !== 'string' || !tokenData.token.startsWith('auth_tokens/')) {
        throw new Error(tokenResponse.status === 503 ? 'Voice is not configured in this environment.' : 'Voice could not connect. Please try again.');
      }
      const client = new GoogleGenAI({ apiKey: tokenData.token, httpOptions: { apiVersion: 'v1alpha' } });
      // Track the ordinary SDK connection so cancellation can close a pending handshake.
      // This is instance-scoped; the SDK constructs the native browser WebSocket itself.
      const originalFactory = client.live.webSocketFactory;
      if (!originalFactory?.create) throw new Error('Voice transport is unavailable.');
      const trackedFactory = { create: (...args) => {
        this.connection = originalFactory.create(...args);
        return this.connection;
      } };
      client.live.webSocketFactory = trackedFactory;
      this.restoreFactory = () => {
        if (client.live.webSocketFactory === trackedFactory) client.live.webSocketFactory = originalFactory;
      };
      const stopped = new Promise((_, reject) => { this.cancelStart = () => reject(new Error('Voice startup ended.')); });
      this.handshakeTimer = this.runtime.setTimeout(() => {
        if (current()) this.fail('Voice connection timed out. Please try again.');
      }, 30000);
      const connecting = client.live.connect({ model: LIVE_MODEL, config: liveConfig(), callbacks: {
        onopen: () => {}, // Socket open is earlier than setupComplete; do not stream yet.
        onmessage: message => { if (current()) this.receive(message); },
        onclose: () => {
          if (!current()) return;
          if (this.status === 'Connecting') this.fail('Voice closed before connecting. Please try again.');
          else this.stop('Voice connection closed.');
        },
        onerror: () => { if (current()) this.fail('Voice connection failed. Please try again.'); },
      } });
      void connecting.then(session => { if (!current()) session.close(); }, () => {});
      const session = await Promise.race([connecting, stopped]);
      if (!current()) return;
      this.runtime.clearTimeout(this.handshakeTimer);
      this.cancelStart = null;
      this.session = session;
      this.setStatus('Connected');
      this.resetInactivity();
      this.capture(AudioContext);
    } catch (error) {
      if (!current()) return;
      const message = error?.name === 'NotAllowedError' ? 'Microphone access was not allowed.' :
        error?.name === 'NotFoundError' ? 'No microphone was found.' :
        error?.name === 'NotReadableError' ? 'The microphone is unavailable or in use.' :
        ['TimeoutError', 'AbortError'].includes(error?.name) ? 'Voice connection timed out. Please try again.' :
        ['Voice needs a secure browser with microphone support.', 'Audio playback is unavailable in this browser.',
          'Voice is not configured in this environment.', 'Voice transport is unavailable.'].includes(error?.message) ? error.message :
        'Voice could not start. Please try again.';
      this.fail(message);
    }
  }

  capture(AudioContext) {
    this.inputContext = new AudioContext();
    const generation = this.generation;
    void this.inputContext.resume().catch(() => {
      if (generation === this.generation) this.fail('Microphone audio could not start. Please try again.');
    });
    this.inputNode = this.inputContext.createMediaStreamSource(this.stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
    const sourceRate = this.inputContext.sampleRate;
    this.processor.onaudioprocess = event => {
      if (!this.session || this.status !== 'Connected') return;
      const input = event.inputBuffer.getChannelData(0);
      const rms = Math.sqrt(input.reduce((sum, value) => sum + value * value, 0) / input.length);
      if (rms > 0.02) {
        this.resetInactivity();
        this.stopPlayback();
        this.setState('listening');
      }
      const ratio = sourceRate / 16000;
      const resampled = new Float32Array(Math.round(input.length / ratio));
      for (let i = 0; i < resampled.length; i++) resampled[i] = input[Math.min(Math.round(i * ratio), input.length - 1)];
      try { this.session.sendRealtimeInput({ audio: { data: encodePCM(resampled), mimeType: 'audio/pcm;rate=16000' } }); }
      catch { this.fail('Voice could not send microphone audio. Please try again.'); }
    };
    this.inputNode.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  receive(message) {
    const content = message.serverContent || {};
    if (content.interrupted || message.interrupted) {
      this.stopPlayback();
      this.finishTurn();
      this.setState('listening');
      return;
    }
    for (const call of message.toolCall?.functionCalls || []) {
      if (call.name === 'queryArchive') void this.queryArchive(call);
    }
    const input = content.inputTranscription?.text || message.inputTranscription?.text;
    if (input) {
      this.inputText += input;
      this.callbacks.onTranscript?.({ role: 'user', text: this.inputText, isFinal: false });
      this.setState('thinking');
    }
    const output = content.outputTranscription?.text || message.outputTranscription?.text;
    if (output) {
      this.outputText += output;
      this.callbacks.onTranscript?.({ role: 'model', text: this.outputText, isFinal: false });
    }
    for (const part of content.modelTurn?.parts || []) {
      if (part.text && !output) {
        this.outputText += part.text;
        this.callbacks.onTranscript?.({ role: 'model', text: this.outputText, isFinal: false });
      }
      if (part.inlineData?.data) {
        this.resetInactivity();
        this.play(part.inlineData.data);
      }
    }
    if (content.turnComplete) this.finishTurn();
  }

  finishTurn() {
    if (this.inputText) this.callbacks.onTranscript?.({ role: 'user', text: this.inputText, isFinal: true });
    if (this.outputText) this.callbacks.onTranscript?.({ role: 'model', text: this.outputText, isFinal: true, sources: this.sources });
    this.inputText = '';
    this.outputText = '';
    this.sources = [];
  }

  async queryArchive(call) {
    const generation = this.generation;
    const session = this.session;
    if (!session) return;
    const current = () => generation === this.generation && session === this.session;
    const query = typeof call.args?.query === 'string' ? call.args.query.trim() : '';
    const controller = new AbortController();
    this.pendingRequests.add(controller);
    this.setState('thinking');
    this.resetInactivity();
    let reply = "I couldn't reach the archive just now.";
    let sources = [];
    try {
      if (!query || query.length > 4000) throw new Error('Invalid archive query.');
      const response = await this.runtime.fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history: [], ...(this.callbacks.pageContext ? { context: this.callbacks.pageContext() } : {}) }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(95000)]),
      });
      const data = await response.json();
      if (!response.ok || typeof data.reply !== 'string' || !Array.isArray(data.sources)) throw new Error('Archive unavailable.');
      reply = data.reply;
      sources = data.sources;
    } catch { /* Keep the archive limitation; never substitute model knowledge. */ }
    finally { this.pendingRequests.delete(controller); }
    if (!current()) return;
    this.sources = sources;
    this.callbacks.onArchiveResult?.({ query, reply, sources });
    try { session.sendToolResponse({ functionResponses: [{ name: call.name, id: call.id, response: { output: reply } }] }); }
    catch { this.fail('Voice could not return the archive answer. Please try again.'); }
  }

  play(data) {
    if (!this.outputContext) return;
    try {
      const samples = decodePCM(data);
      const buffer = this.outputContext.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);
      const source = this.outputContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputContext.destination);
      const now = this.outputContext.currentTime;
      const at = Math.max(now, this.nextPlaybackTime);
      source.start(at);
      this.nextPlaybackTime = at + buffer.duration;
      this.audioSources.add(source);
      this.setState('speaking');
      source.onended = () => { this.audioSources.delete(source); source.disconnect(); };
      this.runtime.clearTimeout(this.playbackTimer);
      this.playbackTimer = this.runtime.setTimeout(() => {
        if (this.status === 'Connected') this.setState('idle');
      }, Math.max(0, (this.nextPlaybackTime - now) * 1000) + 120);
    } catch { this.fail('Voice audio could not be played. Please try again.'); }
  }

  stopPlayback() {
    this.runtime.clearTimeout(this.playbackTimer);
    for (const source of this.audioSources) {
      source.onended = null;
      try { source.stop(); source.disconnect(); } catch { /* Already ended. */ }
    }
    this.audioSources.clear();
    this.nextPlaybackTime = this.outputContext?.currentTime || 0;
  }

  cleanup() {
    ++this.generation;
    this.cancelStart?.();
    this.cancelStart = null;
    this.runtime.clearTimeout(this.handshakeTimer);
    this.runtime.clearTimeout(this.inactivityTimer);
    this.stopPlayback();
    for (const controller of this.pendingRequests) controller.abort();
    this.pendingRequests.clear();
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.callbacks.onMicrophone?.(false);
    if (this.processor) this.processor.onaudioprocess = null;
    for (const node of [this.processor, this.inputNode]) { try { node?.disconnect(); } catch { /* Already detached. */ } }
    this.processor = null;
    this.inputNode = null;
    for (const context of [this.inputContext, this.outputContext]) {
      try { if (context) void context.close().catch(() => {}); } catch { /* Already closed. */ }
    }
    this.inputContext = null;
    this.outputContext = null;
    const connection = this.connection;
    const session = this.session;
    this.connection = null;
    this.session = null;
    this.restoreFactory?.();
    this.restoreFactory = null;
    try { connection?.close(); } catch { /* Already closed. */ }
    try { session?.close(); } catch { /* Already closed. */ }
    this.finishTurn();
    this.setState('idle');
  }

  fail(message) { this.cleanup(); this.setStatus('Error', message); }
  stop(message = '') { this.cleanup(); this.setStatus('Disconnected', message); }
}
