(() => {
  'use strict';
  if (document.getElementById('aoai-archivist-panel')) return;
  const assetRoot = new URL('./archivist/', document.currentScript.src);
  const portrait = new URL('archivist-portrait.jpg', assetRoot).href;
  const idleVideo = new URL('archivist-idle.mp4', assetRoot).href;
  const voiceModuleUrl = new URL('./archivist-voice.js?v=292c6530d8ef', document.currentScript.src).href;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const history = [];
  let loading = false;
  let activeRequest = null;
  let sourceListId = 0;
  let videoFailed = false;
  let lastFailedQuery = '';
  let focusBeforeOpen = null;
  const backgroundLoops = new Map();
  let voiceClient = null;
  let voicePromise = null;
  let voiceAttempt = 0;
  let voiceIntent = false;
  const voiceMessages = { user: null, model: null };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function avatar(size = '', animated = false) {
    const container = element('span', `aoai-archivist-avatar ${size}`);
    const image = element('img');
    image.src = portrait;
    image.alt = '';
    image.addEventListener('error', () => { image.hidden = true; });
    container.append(image);
    if (animated) {
      const clip = element('video');
      clip.muted = true;
      clip.loop = true;
      clip.playsInline = true;
      clip.preload = 'none';
      clip.setAttribute('aria-hidden', 'true');
      clip.addEventListener('error', () => {
        videoFailed = true;
        clip.classList.remove('is-playing');
      });
      clip.addEventListener('playing', () => {
        if (panel.open && !reducedMotion.matches && !document.hidden) clip.classList.add('is-playing');
      });
      container.append(clip);
    }
    return container;
  }

  function pageContext() {
    const entry = location.pathname.match(/(?:^|\/)age-of-aimpires-entry-(\d+)(?:\.html)?\/?$/i);
    const heading = document.querySelector('main h1, h1');
    let section = '';
    const headings = [...document.querySelectorAll('main h2, main h3')];
    for (const item of headings) {
      if (item.getBoundingClientRect().top <= innerHeight * 0.45) section = item.textContent.trim();
    }
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    let currentUrl = new URL(location.pathname, 'https://ageofaimpires.com');
    if (canonical) {
      try {
        const candidate = new URL(canonical);
        if (candidate.origin === 'https://ageofaimpires.com') currentUrl = candidate;
      } catch { /* Use the actual page path if metadata is invalid. */ }
    }
    currentUrl.search = '';
    currentUrl.hash = '';
    return {
      current_url: currentUrl.href.slice(0, 2048),
      current_page: (heading?.textContent.trim() || document.title).slice(0, 300),
      current_entry: entry ? `Entry #${entry[1]}` : '',
      current_section: section.slice(0, 300),
      site_language: (document.documentElement.lang || 'en').slice(0, 35),
    };
  }

  const sessionKey = 'aoai:archivist:conversation:v1';
  let transcript = [];
  let pending = null;
  const context = pageContext();
  const prompt = 'TALK WITH THE ARCHIVIST';
  const launcher = element('button', 'aoai-archivist aoai-archivist-launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', prompt);
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'aoai-archivist-panel');
  launcher.setAttribute('aria-expanded', 'false');
  const launcherText = element('span', 'aoai-archivist-name', prompt);
  launcher.append(avatar('aoai-archivist-avatar-small'), launcherText);

  const panel = element('dialog', 'aoai-archivist aoai-archivist-panel');
  panel.id = 'aoai-archivist-panel';
  panel.setAttribute('aria-labelledby', 'aoai-archivist-title');
  const head = element('div', 'aoai-archivist-panel-head');
  const identity = element('div');
  const title = element('h2', '', prompt);
  title.id = 'aoai-archivist-title';
  identity.append(title);
  const close = element('button', 'aoai-archivist-close', '\u2212');
  close.type = 'button';
  close.setAttribute('aria-label', 'Collapse The Archivist');
  head.append(avatar('', true), identity, close);
  const video = head.querySelector('video');

  const scroll = element('div', 'aoai-archivist-scroll');
  const intro = element('div', 'aoai-archivist-intro');
  intro.append(element('p', '', 'Explore The Entries In The Published Archive.'));
  const suggestions = element('div', 'aoai-archivist-suggestions');
  const queries = ['What is the Completion Boundary?', 'How to write more effective prompts.',
    'When to automate tasks and how to scope their authority.', 'Which Assistant fits the Job Description best?'];
  for (const query of queries) {
    const button = element('button', '', query);
    button.type = 'button';
    button.addEventListener('click', () => send(query));
    suggestions.append(button);
  }
  intro.append(suggestions);
  const log = element('div', 'aoai-archivist-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', 'Conversation with The Archivist');
  log.setAttribute('aria-live', 'polite');
  const thinking = element('p', 'aoai-archivist-thinking', 'Searching the archive…');
  thinking.setAttribute('role', 'status');
  thinking.hidden = true;
  const error = element('div', 'aoai-archivist-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const errorText = element('p');
  const retry = element('button', 'aoai-archivist-retry', 'Try again');
  retry.type = 'button';
  retry.addEventListener('click', () => send(lastFailedQuery, true, pending?.body));
  error.append(errorText, retry);
  scroll.append(intro, log, thinking, error);

  const form = element('form', 'aoai-archivist-form');
  const row = element('div', 'aoai-archivist-input-row');
  const input = element('textarea', 'aoai-archivist-input');
  input.id = 'aoai-archivist-input';
  input.rows = 2;
  input.maxLength = 4000;
  input.placeholder = context.current_entry ? 'What would you like to know about this entry?' : 'Ask a question about the archive…';
  input.required = true;
  const sendButton = element('button', 'aoai-archivist-send', 'Send');
  sendButton.type = 'submit';
  row.append(input, sendButton);
  const note = element('p', 'aoai-archivist-form-note', 'Enter to send · Shift + Enter for a new line');
  note.id = 'aoai-archivist-input-note';
  input.setAttribute('aria-describedby', note.id);
  input.setAttribute('aria-label', 'Question for The Archivist');
  form.append(row, note);
  const voiceControls = element('div', 'aoai-archivist-voice-controls');
  const startVoice = element('button', 'aoai-archivist-voice-button', 'Start Voice');
  startVoice.type = 'button';
  startVoice.setAttribute('aria-label', 'Start Voice');
  const endVoice = element('button', 'aoai-archivist-voice-button', 'End Voice');
  endVoice.type = 'button';
  endVoice.setAttribute('aria-label', 'End Voice');
  endVoice.hidden = true;
  const voiceStatus = element('span', 'aoai-archivist-voice-status', 'Ready');
  voiceStatus.setAttribute('role', 'status');
  voiceStatus.setAttribute('aria-label', 'Voice connection');
  const voiceActivity = element('span', 'aoai-archivist-voice-activity');
  const microphone = element('span', 'aoai-archivist-voice-microphone', 'Microphone Active');
  microphone.hidden = true;
  const voiceNotice = element('p', 'aoai-archivist-voice-notice');
  voiceNotice.hidden = true;
  voiceNotice.setAttribute('role', 'alert');
  row.insertBefore(startVoice, sendButton);
  row.insertBefore(endVoice, sendButton);
  voiceControls.hidden = true;
  voiceControls.append(voiceStatus, microphone, voiceActivity, voiceNotice);
  form.append(voiceControls);
  panel.append(head, scroll, form);
  document.body.append(launcher, panel);

  function updateVideo() {
    if (!panel.open || reducedMotion.matches || videoFailed || document.hidden) {
      video.pause();
      video.classList.remove('is-playing');
      if (reducedMotion.matches && video.hasAttribute('src')) {
        video.removeAttribute('src');
        video.load();
      }
      return;
    }
    if (!video.hasAttribute('src')) video.src = idleVideo;
    video.play().catch(() => { video.classList.remove('is-playing'); });
  }

  function pauseBackgroundLoops() {
    for (const clip of document.querySelectorAll('video[loop]')) {
      if (panel.contains(clip)) continue;
      const state = { playing: !clip.paused, pause: null };
      state.pause = () => {
        if (panel.open) { state.playing = true; clip.pause(); }
      };
      backgroundLoops.set(clip, state);
      clip.addEventListener('play', state.pause);
      clip.pause();
    }
  }

  function restoreBackgroundLoops() {
    for (const [clip, state] of backgroundLoops) {
      clip.removeEventListener('play', state.pause);
      if (state.playing && !reducedMotion.matches && !document.hidden) clip.play().catch(() => {});
    }
    backgroundLoops.clear();
  }

  launcher.addEventListener('click', () => {
    focusBeforeOpen = document.activeElement;
    panel.showModal();
    launcher.setAttribute('aria-expanded', 'true');
    document.body.classList.add('aoai-archivist-open');
    input.focus({ preventScroll: true });
    scroll.scrollTop = scroll.scrollHeight;
    pauseBackgroundLoops();
    updateVideo();
    // Load only the small controller on panel open; no permission or token request.
    ensureVoice().catch(() => {});
  });
  close.addEventListener('click', () => panel.close());
  panel.addEventListener('click', event => {
    const bounds = panel.getBoundingClientRect();
    if (event.target === panel && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) panel.close();
  });
  panel.addEventListener('close', () => {
    stopVoice();
    launcher.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('aoai-archivist-open');
    updateVideo();
    restoreBackgroundLoops();
    focusBeforeOpen?.focus({ preventScroll: true });
  });
  reducedMotion.addEventListener('change', updateVideo);
  document.addEventListener('visibilitychange', updateVideo);
  form.addEventListener('submit', event => { event.preventDefault(); send(input.value); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(input.value); }
  });

  function showVoiceStatus(status, notice = '') {
    const active = status === 'Connecting' || status === 'Connected';
    voiceControls.hidden = !active && !notice;
    voiceIntent = active;
    startVoice.hidden = active;
    endVoice.hidden = !active;
    voiceStatus.textContent = status;
    voiceNotice.textContent = notice;
    voiceNotice.hidden = !notice;
    if (!active) { microphone.hidden = true; voiceActivity.textContent = ''; }
  }

  function ensureVoice() {
    if (!voicePromise) {
      voicePromise = import(voiceModuleUrl).then(({ ArchivistVoice }) => {
        voiceClient = new ArchivistVoice({
          pageContext,
          onStatus: showVoiceStatus,
          onMicrophone: active => { microphone.hidden = !active; },
          onState: state => {
            voiceActivity.textContent = voiceIntent ? ({ listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', idle: 'Listening' }[state] || '') : '';
          },
          onTranscript: event => {
            if (!event.text) return;
            suggestions.hidden = true;
            const message = voiceMessages[event.role] || addMessage(event.role, event.text);
            voiceMessages[event.role] = message;
            message.querySelector('.aoai-archivist-message-text').textContent = event.text;
            if (event.isFinal) {
              if (event.role === 'model') appendSources(message, event.sources || []);
              history.push({ role: event.role, content: event.text });
              transcript.push({ role: event.role, content: event.text, sources: event.sources || [] });
              if (event.role === 'model') addActions(message);
              save();
              voiceMessages[event.role] = null;
            }
            scroll.scrollTop = scroll.scrollHeight;
          },
        });
        return voiceClient;
      }).catch(error => { voicePromise = null; throw error; });
    }
    return voicePromise;
  }

  startVoice.addEventListener('click', async () => {
    const attempt = ++voiceAttempt;
    showVoiceStatus('Connecting');
    try {
      const client = await ensureVoice();
      if (attempt !== voiceAttempt || !panel.open) return;
      await client.start();
    } catch {
      if (attempt === voiceAttempt) showVoiceStatus('Error', 'Voice could not load. Please try again.');
    }
  });
  function stopVoice() {
    ++voiceAttempt;
    voiceIntent = false;
    if (voiceClient) voiceClient.stop();
    else showVoiceStatus('Disconnected');
  }
  endVoice.addEventListener('click', stopVoice);
  window.addEventListener('pagehide', stopVoice);
  window.addEventListener('pagehide', cancelSearch);

  function addMessage(role, content, sources = []) {
    const message = element('div', `aoai-archivist-message ${role === 'user' ? 'aoai-archivist-message-reader' : ''}`);
    const name = element('div', 'aoai-archivist-message-label');
    if (role === 'model') name.append(avatar('aoai-archivist-avatar-message'));
    name.append(element('span', '', role === 'user' ? 'READER' : 'THE ARCHIVIST'));
    message.append(name, element('div', 'aoai-archivist-message-text', content));
    appendSources(message, sources);
    log.append(message);
    return message;
  }

  function appendSources(message, sources) {
    if (sources.length) {
      const sourceList = element('div', 'aoai-archivist-source-list');
      sourceList.append(element('h3', '', 'FROM THE ARCHIVE'));
      for (const source of sources) {
        // The server supplies canonical URLs; refuse executable/unrelated URLs.
        let url;
        try { url = new URL(source.canonicalUrl); } catch { continue; }
        if (url.origin !== 'https://ageofaimpires.com' || url.username || url.password) continue;
        const card = element('div', 'aoai-archivist-source');
        const link = element('a', '', source.title);
        link.href = source.canonicalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        card.append(link);
        const metadata = [source.pageType, source.section, source.publicationDate].filter(Boolean).join(' · ');
        if (metadata) card.append(element('span', 'aoai-archivist-source-meta', metadata));
        if (source.snippet) card.append(element('p', 'aoai-archivist-source-snippet', source.snippet));
        sourceList.append(card);
      }
      const count = sourceList.children.length - 1;
      if (count) {
        const sourcesSection = element('div', 'aoai-archivist-sources');
        const toggle = element('button', 'aoai-archivist-sources-toggle', `Sources (${count})`);
        toggle.type = 'button';
        sourceList.id = `aoai-archivist-sources-${++sourceListId}`;
        sourceList.hidden = true;
        toggle.setAttribute('aria-controls', sourceList.id);
        toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', () => {
          sourceList.hidden = !sourceList.hidden;
          toggle.setAttribute('aria-expanded', String(!sourceList.hidden));
        });
        sourcesSection.append(toggle, sourceList);
        message.append(sourcesSection);
      }
    }
  }

  function requestHistory() {
    const recent = history.slice(-8).map(message => ({ role: message.role, content: message.content.slice(0, 8000) }));
    while (recent.reduce((length, message) => length + message.content.length, 0) > 32000) recent.shift();
    return recent;
  }

  function requestBody(query) {
    const body = { query, history: requestHistory(), context: pageContext() };
    // Also fit the streamed byte limit when the conversation is multilingual.
    while (new TextEncoder().encode(JSON.stringify(body)).length > 65000 && body.history.length) body.history.shift();
    return JSON.stringify(body);
  }

  function setLoading(active) {
    loading = active;
    thinking.hidden = !active;
    sendButton.disabled = active;
    sendButton.textContent = active ? 'Wait' : 'Send';
  }

  function cancelSearch() {
    const request = activeRequest;
    activeRequest = null;
    request?.abort();
    setLoading(false);
  }

  async function send(value, isRetry = false, originalBody = null) {
    const query = value.trim();
    if (!query || loading || query.length > 4000) return;
    const request = new AbortController();
    activeRequest = request;
    setLoading(true);
    error.hidden = true;
    input.value = '';
    suggestions.hidden = true;
    if (!isRetry) { addMessage('user', query); transcript.push({role: 'user', content: query}); }
    pending = { query, body: originalBody || requestBody(query) };
    save();
    scroll.scrollTop = scroll.scrollHeight;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: pending.body,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(95000)]),
      });
      const data = await response.json();
      if (activeRequest !== request) return;
      if (!response.ok) throw new Error(data.error || 'The Archivist is unavailable. Please try again.');
      if (typeof data.reply !== 'string' || !Array.isArray(data.sources)) throw new Error('The archive returned an unreadable answer. Please try again.');
      addActions(addMessage('model', data.reply, data.sources));
      transcript.push({ role: 'model', content: data.reply, sources: data.sources });
      pending = null;
      history.push({ role: 'user', content: query }, { role: 'model', content: data.reply });
      lastFailedQuery = '';
    } catch (failure) {
      if (activeRequest !== request) return;
      pending = null;
      lastFailedQuery = query;
      errorText.textContent = failure.name === 'TimeoutError' ? 'The archive took too long to respond. Please try again.' :
        failure instanceof TypeError || failure instanceof SyntaxError ? 'The archive could not be reached. Please try again.' : failure.message;
      error.hidden = false;
    } finally {
      // A cancelled request must not clear the state of a newer request.
      if (activeRequest === request) {
        activeRequest = null;
        save();
        setLoading(false);
        scroll.scrollTop = scroll.scrollHeight;
        if (panel.open) input.focus({ preventScroll: true });
      }
    }
  }
  // Render a small prose-only Markdown subset. Model text never becomes HTML
  // or a clickable URL; links remain the responsibility of the source cards.
  function formatAnswer(body, raw) {
    function inline(node, text) {
      let start = 0;
      for (const m of text.matchAll(/(\x60)([^\x60\n]+)\1|(\*\*|__)(\S(?:[^\n]*?\S)?)\3|(\*)([^*\n]+?)\5/g)) {
        node.append(text.slice(start, m.index), element(m[1] ? 'code' : m[3] ? 'strong' : 'em', '', m[2] || m[4] || m[6]));
        start = m.index + m[0].length;
      }
      node.append(text.slice(start));
    }
    body.replaceChildren();
    body.classList.add('aoai-archivist-answer');
    let paragraph = [], list, code;
    const flush = () => {
      if (!paragraph.length) return;
      const p = element('p'); inline(p, paragraph.join('\n')); body.append(p); paragraph = [];
    };
    for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
      if (/^\s*\x60{3}/.test(line)) {
        flush(); list = null;
        if (code) code = null;
        else { code = element('pre'); body.append(code); }
        continue;
      }
      if (code) { code.append(line + '\n'); continue; }
      if (!line.trim()) { flush(); continue; }
      const item = line.match(/^\s*(?:(\d{1,9})[.)]|[-+*])\s+(.+)$/);
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      if (item) {
        flush();
        const tag = item[1] ? 'ol' : 'ul';
        if (list?.localName !== tag) { list = element(tag); body.append(list); }
        const li = element('li'); if (item[1]) li.value = Number(item[1]);
        inline(li, item[2]); list.append(li);
      } else if (list && /^\s{2,}/.test(line)) {
        list.lastElementChild.append('\n'); inline(list.lastElementChild, line.trim());
      } else {
        list = null;
        if (heading) { flush(); const h = element('h3'); inline(h, heading[1]); body.append(h); }
        else paragraph.push(line);
      }
    }
    flush();
    return [...body.children].map(el => el.matches('ul,ol')
      ? [...el.children].map(li => (el.localName === 'ol' ? li.value + '. ' : '• ') + li.textContent).join('\n')
      : el.textContent).join('\n\n');
  }

  function addActions(message) {
    const body = message.querySelector('.aoai-archivist-message-text');
    const raw = body.textContent;
    const plain = formatAnswer(body, raw);
    const bar = element('div', 'aoai-archivist-answer-actions');
    const copy = element('button', '', 'Copy');
    const download = element('button', '', 'Export');
    copy.type = download.type = 'button';
    const output = text => {
      const links = [...message.querySelectorAll('.aoai-archivist-source a')].map(a => a.textContent + ': ' + a.href);
      return text + (links.length ? '\n\nSources\n' + links.join('\n') : '');
    };
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(output(plain)); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Copy unavailable'; }
    };
    download.onclick = () => {
      const a = element('a');
      a.href = URL.createObjectURL(new Blob([output(raw)], { type: 'text/markdown;charset=utf-8' }));
      a.download = 'archivist-response.md'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    bar.append(copy, download); message.append(bar);
  }

  function markResume() {
    launcherText.textContent = transcript.length ? 'RESUME CHAT WITH THE ARCHIVIST' : prompt;
    launcher.setAttribute('aria-label', launcherText.textContent);
  }
  function save() {
    markResume();
    try { sessionStorage.setItem(sessionKey, JSON.stringify({ transcript, history, pending, lastFailedQuery })); }
    catch { /* Storage unavailable: the current page still retains the conversation. */ }
  }
  function restore(internalNavigation) {
    let state;
    try { state = JSON.parse(sessionStorage.getItem(sessionKey)); } catch { return; }
    if (!Array.isArray(state?.transcript) || !Array.isArray(state.history)) return;
    transcript = state.transcript;
    log.replaceChildren();
    history.length = 0; history.push(...state.history);
    for (const turn of transcript) {
      const message = addMessage(turn.role, turn.content, turn.sources || []);
      if (turn.role === 'model') addActions(message);
    }
    suggestions.hidden = transcript.length > 0;
    markResume();
    pending = state.pending;
    lastFailedQuery = pending?.query || state.lastFailedQuery || '';
    error.hidden = !lastFailedQuery;
    if (lastFailedQuery) errorText.textContent = 'The last question did not finish. Try again to continue.';
    if (pending && internalNavigation) send(pending.query, true, pending.body);
  }
  restore(document.referrer.startsWith(location.origin + '/'));
  window.addEventListener('pageshow', event => { if (event.persisted) restore(false); });
})();
