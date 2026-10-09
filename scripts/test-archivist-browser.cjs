// Uses an existing Playwright installation and installed Edge; no packages installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter(file => file.endsWith('.html'));
const screenshotDir = path.join(os.tmpdir(), 'ageofaimpires-archivist-v1-qa');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };

(async () => {
  const source = fs.readFileSync(path.join(root, '_worker.js'), 'utf8');
  const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/chat') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const response = await worker.fetch(new Request(`http://127.0.0.1:${server.address().port}${req.url}`, {
        method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
      }), {});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
      return;
    }
    let route = decodeURIComponent(url.pathname);
    if (route === '/') route = '/index.html';
    if (!path.extname(route)) route += '.html';
    const file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const errors = [];
  fs.mkdirSync(screenshotDir, { recursive: true });
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark']) {
        await context.addInitScript(theme => localStorage.setItem('ageofaimpires:theme:v1', theme), theme);
        for (const file of pages) {
          await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
          const launcher = page.locator('.aoai-archivist-launcher');
          await launcher.waitFor({ state: 'visible' }).catch(error => {
            throw new Error(`${file}, ${viewport.width}px, ${theme}: ${error.message}; browser errors: ${errors.join('; ')}`);
          });
          assert.equal(await launcher.count(), 1);
          assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
          assert.ok(await page.locator('[data-theme-toggle]').isVisible());
          assert.equal(await page.locator('body > header').evaluate(node => getComputedStyle(node).position), 'sticky');
          for (const link of await page.locator('footer .aoai-social-links a').all()) assert.ok(await link.isVisible());
          assert.equal(await page.locator('footer .aoai-social-links a').count(), 3);
          assert.equal(await page.locator('body > header').getByText('The Archivist', { exact: false }).count(), 0);
          assert.equal(await launcher.getAttribute('aria-label'), file.startsWith('age-of-aimpires-entry-') ? 'Ask about this entry' : 'Ask The Archivist');
          const launcherBounds = await launcher.boundingBox();
          assert.ok(launcherBounds.x >= 0 && launcherBounds.x + launcherBounds.width <= viewport.width);
          assert.ok(launcherBounds.y + launcherBounds.height <= viewport.height);
          await launcher.click();
          const panel = page.locator('#aoai-archivist-panel');
          await panel.waitFor({ state: 'visible' });
          const bounds = await panel.boundingBox();
          assert.equal(Math.round(bounds.width), viewport.width > 600 ? 440 : viewport.width);
          assert.equal(Math.round(bounds.height), viewport.height);
          assert.ok(await panel.evaluate(node => node.scrollWidth <= node.clientWidth));
          assert.equal(await page.locator('.aoai-archivist-input').evaluate(node => document.activeElement === node), true);
          assert.equal(await panel.locator('video').count(), 1);
          assert.equal(await panel.locator('video').getAttribute('src'), null, 'Reduced motion must not load video');
          assert.equal(await panel.locator('video').evaluate(node => node.paused), true);
          assert.doesNotMatch(await panel.innerText(), /Librarian/i);
          assert.ok(await panel.getByRole('button', { name: 'Start Voice', exact: true }).isVisible());
          assert.equal(await panel.getByRole('button', { name: 'End Voice', exact: true }).isVisible(), false);
          if (file === 'index.html') await page.screenshot({ path: path.join(screenshotDir, `${viewport.width}-${theme}.png`) });
          await page.keyboard.press('Escape');
          await panel.waitFor({ state: 'hidden' });
          await page.waitForFunction(() => document.querySelector('.aoai-archivist-launcher').getAttribute('aria-expanded') === 'false');
          assert.equal(await launcher.getAttribute('aria-expanded'), 'false');
          assert.ok(await launcher.evaluate(node => document.activeElement === node));
        }
      }
    }

    // Scope narrow-screen overflow to the new panel; existing layouts are untouched.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`${base}/index.html`);
    await page.locator('.aoai-archivist-launcher').click();
    assert.ok(await page.locator('#aoai-archivist-panel').evaluate(node => node.scrollWidth <= node.clientWidth));
    await page.locator('.aoai-archivist-close').click();

    // Shared controls and native dialog keyboard focus are still operational.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/how-to.html`);
    const beforeTheme = await page.locator('html').getAttribute('data-theme');
    await page.locator('[data-theme-toggle]').click();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), beforeTheme);
    const menu = page.locator('header .menu-toggle');
    if (await menu.count()) {
      await menu.click();
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      await menu.click();
    }
    await page.locator('.aoai-archivist-launcher').click();
    await page.keyboard.press('Shift+Tab');
    assert.ok(await page.locator('#aoai-archivist-panel').evaluate(node => node.contains(document.activeElement)));
    await page.locator('.aoai-archivist-close').click();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/age-of-aimpires-entry-01.html`);
    await page.locator('main h2').first().evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.locator('.aoai-archivist-launcher').click();
    const input = page.locator('.aoai-archivist-input');
    const send = page.locator('.aoai-archivist-send');
    await input.fill('What does this entry argue?');
    await send.click();
    await page.locator('.aoai-archivist-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('.aoai-archivist-error').innerText(), /temporarily unavailable/);
    assert.ok(await send.isEnabled());

    const requests = [];
    let finishRequest;
    let immediateResponse = null;
    await page.route('**/api/chat', async route => {
      requests.push(route.request().postDataJSON());
      const response = immediateResponse || await new Promise(resolve => { finishRequest = resolve; });
      await route.fulfill({ status: response.status || 200, contentType: 'application/json', body: JSON.stringify(response.body) });
    });
    await page.locator('.aoai-archivist-retry').click();
    await page.locator('.aoai-archivist-thinking').waitFor({ state: 'visible' });
    assert.ok(await send.isDisabled());
    assert.equal(requests[0].context.current_entry, 'Entry #01');
    assert.equal(requests[0].context.current_page, 'Fast AI. Expensive Lesson.');
    assert.equal(requests[0].context.site_language, 'en-GB');
    assert.ok(requests[0].context.current_section.length > 0);
    assert.ok(await page.locator('main h2, main h3').evaluateAll((headings, section) => headings.some(heading => heading.textContent.trim() === section), requests[0].context.current_section));
    assert.match(requests[0].context.current_url, /^https:\/\/ageofaimpires.com\/age-of-aimpires-entry-01/);
    assert.deepEqual(requests[0].history, [], 'Failed turns must not enter history');
    const source = { title: 'Fast AI. Expensive Lesson.', canonicalUrl: 'https://ageofaimpires.com/age-of-aimpires-entry-01', section: 'The Completion Boundary', pageType: 'entry', snippet: 'A published passage.' };
    finishRequest({ body: { reply: 'Fixture: the Completion Boundary.\nA second paragraph.', sources: [source] } });
    await page.locator('.aoai-archivist-source').waitFor();
    assert.equal(await page.locator('.aoai-archivist-message-reader').count(), 1, 'Retry must not duplicate the failed question');
    assert.equal(await page.locator('.aoai-archivist-sources h3').innerText(), 'FROM THE ARCHIVE');
    const link = page.locator('.aoai-archivist-source a');
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await link.getAttribute('href'), source.canonicalUrl);
    assert.equal(await page.locator('.aoai-archivist-thinking').isVisible(), false);
    assert.equal(await page.locator('.aoai-archivist-error').isVisible(), false);
    await page.screenshot({ path: path.join(screenshotDir, 'desktop-chat-sources.png') });

    immediateResponse = { body: { reply: '<img src=x onerror=alert(1)> Plain text fixture.', sources: [
      { ...source, canonicalUrl: 'javascript:alert(1)' }, { ...source, canonicalUrl: 'https://other.example' },
    ] } };
    await input.fill('Follow-up question');
    await input.press('Enter');
    await page.locator('.aoai-archivist-message-text').filter({ hasText: 'Plain text fixture.' }).waitFor();
    assert.deepEqual(requests[1].history.map(turn => turn.role), ['user', 'model']);
    assert.equal(await page.locator('.aoai-archivist-message-text img').count(), 0);
    assert.equal(await page.locator('.aoai-archivist-source a').count(), 1, 'Unsafe source URLs rejected');
    await page.locator('.aoai-archivist-close').click();
    await page.locator('.aoai-archivist-launcher').click();
    assert.equal(await page.locator('.aoai-archivist-message-reader').count(), 2, 'Panel reopening preserves page-session conversation');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-chat-sources.png') });
    await page.locator('.aoai-archivist-close').click();

    // Keep the existing conversation while checking source cards in the other theme.
    await page.locator('[data-theme-toggle]').click();
    await page.locator('.aoai-archivist-launcher').click();
    assert.equal(await page.locator('.aoai-archivist-source a').getAttribute('href'), source.canonicalUrl);
    assert.ok(await page.locator('.aoai-archivist-source a').isVisible());
    await page.screenshot({ path: path.join(screenshotDir, 'mobile-chat-other-theme.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(screenshotDir, 'desktop-chat-other-theme.png') });
    await page.locator('.aoai-archivist-close').click();

    await page.goto(`${base}/index.html`);
    await page.locator('.aoai-archivist-launcher').click();
    assert.equal(await page.locator('.aoai-archivist-message').count(), 0, 'New page starts a new conversation');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => !!document.querySelector('.aoai-archivist-panel video')?.src);
    assert.equal(await page.locator('.aoai-archivist-panel video').count(), 1);
    await page.waitForFunction(() => document.querySelector('.aoai-archivist-panel video').classList.contains('is-playing'));
    await page.locator('.aoai-archivist-close').click();
    await page.waitForFunction(() => document.querySelector('.aoai-archivist-panel video').paused);
    assert.equal(await page.locator('.aoai-archivist-panel video').evaluate(node => node.paused), true);
    await page.locator('.aoai-archivist-launcher').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.aoai-archivist-panel video').hasAttribute('src'));
    assert.equal(await page.locator('.aoai-archivist-panel video').getAttribute('src'), null);
    assert.equal(await page.locator('.aoai-archivist-panel video').evaluate(node => node.paused), true);
    await page.locator('.aoai-archivist-close').click();

    // The contact page already has a looping portrait. Pause it during the panel.
    await page.route('**/media/contact-portrait.mp4', route => route.fulfill({
      contentType: 'video/mp4', body: fs.readFileSync(path.join(root, 'assets/archivist/archivist-idle.mp4')),
    }));
    await page.goto(`${base}/contact.html`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#contactPortraitVideo').evaluate(clip => clip.play());
    await page.locator('.aoai-archivist-launcher').click();
    assert.equal(await page.locator('#contactPortraitVideo').evaluate(clip => clip.paused), true);
    await page.waitForFunction(() => document.querySelector('.aoai-archivist-panel video').classList.contains('is-playing'));
    assert.equal(await page.locator('video[loop]').evaluateAll(clips => clips.filter(clip => !clip.paused).length), 1);
    await page.locator('.aoai-archivist-close').click();
    await page.waitForFunction(() => !document.querySelector('#contactPortraitVideo').paused);

    // A broken video must leave the portrait visible.
    await page.route('**/assets/archivist/archivist-idle.mp4', route => route.fulfill({ status: 404, body: '' }));
    await page.goto(`${base}/index.html`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.aoai-archivist-launcher').click();
    await page.waitForFunction(() => document.querySelector('.aoai-archivist-panel video').error !== null);
    assert.equal(await page.locator('.aoai-archivist-panel video').evaluate(node => getComputedStyle(node).opacity), '0');
    assert.ok(await page.locator('.aoai-archivist-panel-head img').isVisible());
    // Offline UI voice acceptance with the real browser SDK serializer. No real
    // microphone, Gemini traffic or global WebSocket replacement.
    await page.goto(`${base}/index.html`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await context.route('**/api/voice/token', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'auth_tokens/offline-ui' }) }));
    let voiceLookups = 0;
    await page.route('**/api/chat', route => {
      voiceLookups++;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'The Completion Boundary is the usable finish.', sources: [source] }) });
    });
    await page.evaluate(async () => {
      const fixture = window.__voiceFixture = { tracks: [], contexts: [], sockets: [], requests: 0, acknowledge: true };
      class Node {
        connect() {} disconnect() {} start() {} stop() {}
      }
      class Audio {
        sampleRate = 48000; currentTime = 1; state = 'running'; destination = {};
        constructor() { fixture.contexts.push(this); }
        async resume() { this.state = 'running'; }
        async close() { this.state = 'closed'; }
        createMediaStreamSource() { return new Node(); }
        createScriptProcessor() { return new Node(); }
        createBufferSource() { return new Node(); }
        createBuffer(_channels, length, rate) { return { duration: length / rate, getChannelData: () => new Float32Array(length) }; }
      }
      window.AudioContext = Audio;
      navigator.mediaDevices.getUserMedia = async () => {
        fixture.requests++;
        const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
        fixture.tracks.push(track); return { getTracks: () => [track] };
      };
      const { GoogleGenAI } = await import('/assets/vendor/google-genai-2.27.0.js');
      const prototype = Object.getPrototypeOf(new GoogleGenAI({ apiKey: 'auth_tokens/offline-ui', httpOptions: { apiVersion: 'v1alpha' } }).live.webSocketFactory);
      prototype.create = (_url, _headers, callbacks) => {
        const socket = {
          frames: [], closed: false,
          connect() { callbacks.onopen(new Event('open')); },
          receive(message) { callbacks.onmessage(new MessageEvent('message', { data: JSON.stringify(message) })); },
          send(text) { const frame = JSON.parse(text); this.frames.push(frame); if (frame.setup && fixture.acknowledge) queueMicrotask(() => this.receive({ setupComplete: {} })); },
          close() { if (!this.closed) { this.closed = true; callbacks.onclose({ code: 1000, reason: '' }); } },
        };
        fixture.sockets.push(socket); return socket;
      };
    });
    await page.locator('.aoai-archivist-launcher').click();
    assert.equal(await page.evaluate(() => window.__voiceFixture.requests), 0, 'Opening panel does not request microphone');
    await page.getByRole('button', { name: 'Start Voice', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.aoai-archivist-voice-status').textContent === 'Connected');
    assert.ok(await page.locator('.aoai-archivist-voice-microphone').isVisible());
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('#aoai-archivist-panel').evaluate(node => node.scrollWidth <= node.clientWidth));
    await page.screenshot({ path: path.join(screenshotDir, 'voice-connected-mobile-offline.png') });
    assert.equal(await page.evaluate(() => Function.prototype.toString.call(WebSocket).includes('[native code]')), true);
    await page.evaluate(() => window.__voiceFixture.sockets.at(-1).receive({ toolCall: { functionCalls: [{ name: 'queryArchive', id: 'ui-lookup', args: { query: 'What is the Completion Boundary?' } }] } }));
    await page.waitForFunction(() => window.__voiceFixture.sockets.at(-1).frames.some(frame => frame.toolResponse));
    await page.evaluate(() => window.__voiceFixture.sockets.at(-1).receive({ serverContent: { inputTranscription: { text: 'What is the Completion Boundary?' }, outputTranscription: { text: 'A usable finish.' }, turnComplete: true } }));
    assert.equal(voiceLookups, 1);
    assert.equal(await page.locator('.aoai-archivist-message').last().locator('.aoai-archivist-source a').getAttribute('href'), source.canonicalUrl);
    await page.evaluate(() => window.__voiceFixture.sockets.at(-1).receive({ serverContent: { inputTranscription: { text: 'Hello.' }, outputTranscription: { text: 'Hello.' }, turnComplete: true }, sources: [{ title: 'Invented by Live', canonicalUrl: 'https://ageofaimpires.com/draft' }] }));
    assert.equal(await page.locator('.aoai-archivist-message').last().locator('.aoai-archivist-source').count(), 0);
    assert.equal(voiceLookups, 1, 'Hello does not retrieve');
    await page.getByRole('button', { name: 'End Voice', exact: true }).click();
    assert.equal(await page.locator('.aoai-archivist-voice-status').textContent(), 'Disconnected');
    assert.equal(await page.evaluate(() => window.__voiceFixture.tracks.every(track => track.readyState === 'ended') && window.__voiceFixture.contexts.every(context => context.state === 'closed') && window.__voiceFixture.sockets.every(socket => socket.closed)), true);
    await page.evaluate(() => { window.__voiceFixture.acknowledge = false; });
    await page.getByRole('button', { name: 'Start Voice', exact: true }).click();
    await page.waitForFunction(() => window.__voiceFixture.sockets.length === 2);
    assert.equal(await page.locator('.aoai-archivist-voice-status').textContent(), 'Connecting');
    await page.getByRole('button', { name: 'End Voice', exact: true }).click();
    await page.evaluate(() => window.__voiceFixture.sockets.at(-1).receive({ setupComplete: {} }));
    assert.equal(await page.locator('.aoai-archivist-voice-status').textContent(), 'Disconnected');
    assert.equal(await page.evaluate(() => window.__voiceFixture.tracks.every(track => track.readyState === 'ended') && window.__voiceFixture.sockets.every(socket => socket.closed)), true);
    await page.screenshot({ path: path.join(screenshotDir, 'voice-controls.png') });
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(`Passed: ${pages.length} pages × 2 themes × desktop/mobile; panel dimensions, controls/focus, context, session history, loading/error/retry, source cards, text/URL safety, reduced motion, single idle video and image fallback. Gemini answers mocked; missing-secret response uses the real local Worker.`);
    console.log(`Screenshots: ${screenshotDir}`);
    console.log('Passed: real SDK offline voice controls, no permission on panel open, source bridge, Hello without lookup, native WebSocket unchanged, End Voice and pending-handshake cancellation.');
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
