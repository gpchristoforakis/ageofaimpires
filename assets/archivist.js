(() => {
  'use strict';
  if (document.getElementById('aoai-archivist-panel')) return;
  const assetRoot = new URL('./archivist/', document.currentScript.src);
  const portrait = new URL('archivist-portrait.jpg', assetRoot).href;
  const idleVideo = new URL('archivist-idle.mp4', assetRoot).href;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const history = [];
  let loading = false;
  let videoFailed = false;
  let lastFailedQuery = '';
  let focusBeforeOpen = null;
  const backgroundLoops = new Map();

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

  const context = pageContext();
  const prompt = context.current_entry ? 'Ask about this entry' : 'Ask The Archivist';
  const launcher = element('button', 'aoai-archivist aoai-archivist-launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', prompt);
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'aoai-archivist-panel');
  launcher.setAttribute('aria-expanded', 'false');
  const launcherText = element('span');
  launcherText.append(element('span', 'aoai-archivist-name', 'THE ARCHIVIST'), element('span', 'aoai-archivist-launcher-label', prompt));
  launcher.append(avatar('aoai-archivist-avatar-small'), launcherText);

  const panel = element('dialog', 'aoai-archivist aoai-archivist-panel');
  panel.id = 'aoai-archivist-panel';
  panel.setAttribute('aria-labelledby', 'aoai-archivist-title');
  const head = element('div', 'aoai-archivist-panel-head');
  const identity = element('div');
  const title = element('h2', '', 'THE ARCHIVIST');
  title.id = 'aoai-archivist-title';
  identity.append(title, element('p', 'aoai-archivist-subtitle', 'Guide to the archive'));
  const close = element('button', 'aoai-archivist-close', '\u00d7');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close The Archivist');
  head.append(avatar('', true), identity, close);
  const video = head.querySelector('video');

  const scroll = element('div', 'aoai-archivist-scroll');
  const intro = element('div', 'aoai-archivist-intro');
  intro.append(element('p', '', 'Explore the ideas in the published archive.'));
  intro.append(element('span', 'aoai-archivist-context', context.current_entry ? `${context.current_entry} · ${context.current_page}` : 'Answers grounded in AGE OF AIMPIRES.'));
  const suggestions = element('div', 'aoai-archivist-suggestions');
  const queries = context.current_entry ? ['What does this entry argue?', 'What is the Completion Boundary?'] :
    ['What is the Completion Boundary?', 'Explain Effective Task Cost.'];
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
  retry.addEventListener('click', () => send(lastFailedQuery, true));
  error.append(errorText, retry);
  scroll.append(intro, log, thinking, error);

  const form = element('form', 'aoai-archivist-form');
  const label = element('label', '', prompt);
  label.htmlFor = 'aoai-archivist-input';
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
  form.append(label, row, note);
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
    pauseBackgroundLoops();
    updateVideo();
  });
  close.addEventListener('click', () => panel.close());
  panel.addEventListener('click', event => {
    const bounds = panel.getBoundingClientRect();
    if (event.target === panel && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) panel.close();
  });
  panel.addEventListener('close', () => {
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

  function addMessage(role, content, sources = []) {
    const message = element('div', `aoai-archivist-message ${role === 'user' ? 'aoai-archivist-message-reader' : ''}`);
    const name = element('div', 'aoai-archivist-message-label');
    if (role === 'model') name.append(avatar('aoai-archivist-avatar-message'));
    name.append(element('span', '', role === 'user' ? 'READER' : 'THE ARCHIVIST'));
    message.append(name, element('div', 'aoai-archivist-message-text', content));
    if (sources.length) {
      const sourceList = element('div', 'aoai-archivist-sources');
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
      if (sourceList.children.length > 1) message.append(sourceList);
    }
    log.append(message);
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

  async function send(value, isRetry = false) {
    const query = value.trim();
    if (!query || loading || query.length > 4000) return;
    loading = true;
    thinking.hidden = false;
    error.hidden = true;
    input.value = '';
    sendButton.disabled = true;
    sendButton.textContent = 'Wait';
    suggestions.hidden = true;
    if (!isRetry) addMessage('user', query);
    scroll.scrollTop = scroll.scrollHeight;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: requestBody(query),
        signal: AbortSignal.timeout(95000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The Archivist is unavailable. Please try again.');
      if (typeof data.reply !== 'string' || !Array.isArray(data.sources)) throw new Error('The archive returned an unreadable answer. Please try again.');
      addMessage('model', data.reply, data.sources);
      history.push({ role: 'user', content: query }, { role: 'model', content: data.reply });
      lastFailedQuery = '';
    } catch (failure) {
      lastFailedQuery = query;
      errorText.textContent = failure.name === 'TimeoutError' ? 'The archive took too long to respond. Please try again.' :
        failure instanceof TypeError || failure instanceof SyntaxError ? 'The archive could not be reached. Please try again.' : failure.message;
      error.hidden = false;
    } finally {
      loading = false;
      thinking.hidden = true;
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
      scroll.scrollTop = scroll.scrollHeight;
      if (panel.open) input.focus({ preventScroll: true });
    }
  }
})();
