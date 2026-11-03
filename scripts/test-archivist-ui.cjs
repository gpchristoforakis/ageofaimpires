// Runs inside the existing browser suite against its local static server.
const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async (context, base, screenshotDir) => {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const source = {
    title: 'Fast AI. Expensive Lesson.',
    canonicalUrl: 'https://ageofaimpires.com/age-of-aimpires-entry-01',
    pageType: 'entry', section: 'The Completion Boundary', publicationDate: '2026-01-01',
    snippet: 'A published passage.',
  };
  const input = page.locator('.aoai-archivist-input');
  const send = page.locator('.aoai-archivist-send');
  const thinking = page.locator('.aoai-archivist-thinking');
  const lastMessage = page.locator('.aoai-archivist-message').last();
  const animation = () => thinking.evaluate(node => getComputedStyle(node, '::before').animationName);
  const submit = async query => { await input.fill(query); await input.press('Enter'); };
  const reply = async (sources, text = 'Fixture answer.') => {
    await page.evaluate(({ sources, text }) => window.__uiRequests.at(-1).resolve(
      new Response(JSON.stringify({ reply: text, sources }), { headers: { 'Content-Type': 'application/json' } }),
    ), { sources, text });
    await thinking.waitFor({ state: 'hidden' });
  };
  try {
    await page.goto(`${base}/age-of-aimpires-entry-01.html`);
    // Deliberately allow late resolutions after abort to exercise stale-request guards.
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.__uiRequests = [];
      window.fetch = (url, options) => url === '/api/chat' ? new Promise((resolve, reject) => {
        window.__uiRequests.push({ resolve, reject, signal: options.signal });
      }) : originalFetch(url, options);
    });
    await page.locator('.aoai-archivist-launcher').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await submit('No sources');
    await thinking.waitFor({ state: 'visible' });
    assert.equal(await animation(), 'aoai-archivist-search');
    assert.equal(await thinking.getAttribute('role'), 'status');
    await submit('Duplicate while searching');
    assert.equal(await page.evaluate(() => window.__uiRequests.length), 1);
    assert.ok(await send.isDisabled());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await animation(), 'none');
    assert.ok(await thinking.isVisible());
    await reply([]);
    assert.equal(await lastMessage.locator('.aoai-archivist-sources').count(), 0);
    assert.equal(await animation(), 'none');
    assert.ok(await send.isEnabled());

    await submit('One source');
    await reply([source]);
    const toggle = lastMessage.getByRole('button', { name: 'Sources (1)', exact: true });
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    const controlledId = await toggle.getAttribute('aria-controls');
    assert.equal(await page.locator(`#${controlledId}`).isVisible(), false);
    await toggle.focus();
    await page.keyboard.press('Tab');
    assert.equal(await lastMessage.getByRole('button', { name: 'Copy' }).evaluate(node => node === document.activeElement), true, 'Collapsed links leave tab order');
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator(`#${controlledId}`).isVisible(), true);
    assert.equal(await lastMessage.locator('h3').innerText(), 'FROM THE ARCHIVE');
    const link = lastMessage.locator('.aoai-archivist-source a');
    await page.keyboard.press('Tab');
    assert.equal(await link.evaluate(node => node === document.activeElement), true);
    assert.equal(await link.getAttribute('href'), source.canonicalUrl);
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(await lastMessage.locator('.aoai-archivist-source-meta').innerText(), 'entry · The Completion Boundary · 2026-01-01');
    assert.equal(await lastMessage.locator('.aoai-archivist-source-snippet').innerText(), source.snippet);
    await context.route(source.canonicalUrl, route => route.fulfill({ contentType: 'text/html', body: '<h1>Source destination fixture</h1>' }));
    const popupPromise = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    assert.equal(popup.url(), source.canonicalUrl);
    assert.equal(await popup.evaluate(() => window.opener), null);
    await popup.close();
    await toggle.focus();
    await page.keyboard.press('Space');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async text => { window.__copiedAnswer = text; } }
    }));
    await lastMessage.getByRole('button', { name: 'Copy', exact: true }).click();
    const copied = await page.evaluate(() => window.__copiedAnswer);
    assert.ok(copied.includes(source.canonicalUrl) && copied.includes('Fixture answer.'));
    const [download] = await Promise.all([page.waitForEvent('download'), lastMessage.getByRole('button', { name: 'Export' }).click()]);
    assert.equal(download.suggestedFilename(), 'archivist-response.md');
    assert.equal(require('node:fs').readFileSync(await download.path(), 'utf8'), copied);

    await submit('Multiple sources and rejected URLs');
    await reply([source, { ...source, title: 'Second source' }, { ...source, title: 'Third source' },
      { ...source, canonicalUrl: 'javascript:alert(1)' }, { ...source, canonicalUrl: 'https://other.example/' },
      { ...source, canonicalUrl: 'https://user:password@ageofaimpires.com/' }]);
    const multiple = lastMessage.getByRole('button', { name: 'Sources (3)', exact: true });
    assert.equal(await multiple.getAttribute('aria-expanded'), 'false');
    assert.equal(await lastMessage.locator('.aoai-archivist-source').count(), 3);
    const ids = await page.locator('.aoai-archivist-source-list').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(new Set(ids).size, ids.length);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 900 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        for (const expanded of [false, true]) {
          if ((await multiple.getAttribute('aria-expanded') === 'true') !== expanded) await multiple.click();
          await multiple.scrollIntoViewIfNeeded();
          assert.ok(await page.locator('#aoai-archivist-panel').evaluate(node => node.scrollWidth <= node.clientWidth));
          assert.ok(await page.locator('.aoai-archivist-scroll').evaluate(node => node.scrollWidth <= node.clientWidth));
          await page.screenshot({ path: path.join(screenshotDir, `polish-${width}-${theme}-${expanded ? 'expanded' : 'collapsed'}.png`) });
        }
      }
    }

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const failure of ['server', 'network', 'json', 'timeout']) {
      await submit(`Failure: ${failure}`);
      assert.equal(await animation(), 'aoai-archivist-search');
      await page.evaluate(failure => {
        const request = window.__uiRequests.at(-1);
        if (failure === 'network') request.reject(new TypeError('Failed to fetch'));
        else if (failure === 'timeout') request.reject(new DOMException('Timed out', 'TimeoutError'));
        else request.resolve(new Response(failure === 'json' ? 'invalid json' : JSON.stringify({ error: 'Fixture retrieval failure.' }), { status: failure === 'server' ? 503 : 200 }));
      }, failure);
      await page.locator('.aoai-archivist-error').waitFor({ state: 'visible' });
      assert.equal(await thinking.isVisible(), false);
      assert.equal(await animation(), 'none');
      assert.ok(await send.isEnabled());
    }
    await page.locator('.aoai-archivist-retry').click();
    await reply([], 'Recovered after retry.');
    assert.equal(await page.locator('.aoai-archivist-error').isVisible(), false);

    for (const closeMethod of ['Escape', 'button', 'pagehide']) {
      await submit(`Cancel using ${closeMethod}`);
      const cancelledIndex = await page.evaluate(() => window.__uiRequests.length - 1);
      if (closeMethod === 'Escape') await page.keyboard.press('Escape');
      else if (closeMethod === 'button') await page.locator('.aoai-archivist-close').click();
      else await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      if (closeMethod !== 'pagehide') {
        assert.equal(await page.evaluate(i => window.__uiRequests[i].signal.aborted, cancelledIndex), false);
        await reply([], 'Finished while collapsed.');
        await page.locator('.aoai-archivist-launcher').click();
        assert.equal(await lastMessage.locator('.aoai-archivist-message-text').textContent(), 'Finished while collapsed.');
        continue;
      }
      await page.waitForFunction(index => window.__uiRequests[index].signal.aborted, cancelledIndex);
      assert.equal(await thinking.isVisible(), false);
      assert.ok(await send.isEnabled());
      if (closeMethod !== 'pagehide') await page.locator('.aoai-archivist-launcher').click();
      await submit('New request after cancellation');
      await page.evaluate(index => window.__uiRequests[index].resolve(new Response(JSON.stringify({ reply: 'Stale answer must be ignored.', sources: [] }))), cancelledIndex);
      assert.ok(await thinking.isVisible(), 'Stale completion must not hide current loading state');
      assert.ok(await send.isDisabled());
      assert.equal(await page.getByText('Stale answer must be ignored.', { exact: true }).count(), 0);
      await reply([], 'New request succeeded.');
    }
    await submit('Continue on another page');
    const originalURL = page.url();
    const bodies = [];
    await page.route('**/api/chat', route => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ json: { reply: 'Resumed on the next page.', sources: [source] } });
    });
    await page.goto(base + '/about.html', { referer: originalURL });
    await page.locator('.aoai-archivist-launcher').click();
    await page.getByText('Resumed on the next page.', { exact: true }).waitFor();
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].context.current_entry, 'Entry #01');
    assert.equal(await page.getByText('Continue on another page', { exact: true }).count(), 1);
    // Simulate a new document reached after leaving the site. No automatic lookup.
    await page.evaluate(() => { window.fetch = () => new Promise(() => {}); });
    await submit('Interrupted external visit');
    await page.goto(base + '/index.html', { referer: 'https://example.org/' });
    await page.locator('.aoai-archivist-launcher').click();
    assert.equal(bodies.length, 1);
    await page.locator('.aoai-archivist-retry').click();
    await thinking.waitFor({ state: 'hidden' });
    assert.equal(bodies.length, 2);
    assert.match(bodies[1].context.current_url, /about/);
    assert.deepEqual(errors, []);
    console.log('Passed: Archivist UI polish: 0/1/3 sources, safe links and popup, Enter/Space/Tab, unique controls, 320/390/1440px × both themes, reduced motion, success/error/retry/timeout, duplicate blocking, collapse/resume and pagehide cancellation and stale response race.');
  } finally {
    await page.close();
  }
};
