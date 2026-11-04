const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const preview = await require('./comments-preview-server.cjs')();
  const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args:['--no-proxy-server']});
  let checks = 0;
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce'});
    await context.route('**/*', route => new URL(route.request().url()).origin === preview.url ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const go = file => page.goto(preview.url + '/' + file, {waitUntil:'domcontentloaded'});
    const setTheme = async theme => {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('[data-theme-toggle]').click();
      await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
    };
    const root = path.resolve(__dirname, '..');
    const backPages = fs.readdirSync(root).filter(file => file.endsWith('.html') && fs.readFileSync(path.join(root,file),'utf8').includes('data-back-to-top'));
    for (const width of [320,390,1440]) for (const theme of ['light','dark']) {
      await page.setViewportSize({width,height:844});
      for (const file of backPages) {
        await go(file);
        await setTheme(theme);
        await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
        const button=page.locator('[data-back-to-top]');
        await button.click();
        await page.waitForFunction(()=>scrollY===0);
        assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('main h1, main')),true);
        checks++;
      }
    }
    console.log('Passed: '+checks+' back-to-top pointer checks across widths/themes, including return of keyboard focus.');
    await page.setViewportSize({width:390,height:844});
    for (let entry=1;entry<=3;entry++) {
      await go('age-of-aimpires-entry-0'+entry+'.html');
      await page.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(new Error('simulated playback failure'));};});
      const play=page.locator('.mini-player-button:not([disabled])');
      await play.press('Enter');
      await page.waitForFunction(()=>document.querySelector('.audio-playback-status').textContent.includes('could not be played'));
      assert.equal(await play.getAttribute('aria-label'),entry===1?'Play narration':'Play audio overview');
      assert.equal(await play.getAttribute('aria-pressed'),'false');
      assert.equal(await page.locator('.audio-playback-status').getAttribute('role'),'status');
      await page.evaluate(()=>{HTMLMediaElement.prototype.play=function(){Object.defineProperty(this,'paused',{value:false,configurable:true});this.dispatchEvent(new Event('playing'));return Promise.resolve();};});
      await play.press('Enter');
      assert.equal(await page.locator('.audio-playback-status').textContent(),'');
      assert.equal(await play.getAttribute('aria-label'),entry===1?'Pause narration':'Pause audio overview');
      await page.evaluate(()=>document.querySelector('[data-audio-player] audio').dispatchEvent(new Event('error')));
      assert.match(await page.locator('.audio-playback-status').textContent(),/could not be played/);
      checks++;
    }
    console.log('Passed: three available narration/overview rejection/error/retry states. Playback is simulated, not an audible quality test.');
    await go('notebook.html');
    await page.waitForFunction(()=>document.querySelector('[data-comments-load-status]').textContent.includes('No published'));
    const form=page.locator('[data-comments] form');
    await form.locator('[type=submit]').click();
    assert.equal(await form.locator('[name=name]').evaluate(e=>e.validity.valueMissing),true);
    await form.locator('[name=name]').fill('<img src=x onerror=alert(1)>');
    await form.locator('[name=comment]').fill('A real local submission.\n<script>alert(1)</script>');
    await form.locator('[name=consent]').check();
    await form.locator('[type=submit]').press('Enter');
    await page.waitForFunction(()=>document.querySelector('[data-comment-status]').textContent.includes('now published'));
    await page.waitForFunction(()=>document.querySelector('[data-comments-list]').children.length===1);
    assert.equal(await page.locator('[data-comments-list] img, [data-comments-list] script').count(),0);
    assert.match(await page.locator('[data-comments-list]').textContent(),/<script>alert/);
    assert.equal(preview.db.sql.prepare('SELECT count(*) n FROM comments').get().n,1);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('[data-comments-list]').children.length===1);
    await go('about.html');
    await page.waitForFunction(()=>document.querySelector('[data-comments-load-status]').textContent.includes('No published'));
    assert.equal(await page.locator('[data-comments-list] li').count(),0);
    await context.route('**/api/comments',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'}):route.fallback());
    await form.locator('[name=name]').fill('Reader');
    await form.locator('[name=comment]').fill('Keep this draft on error.');
    await form.locator('[name=consent]').check();
    await form.locator('[type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('[data-comment-status]').textContent.includes('could not be submitted'));
    assert.equal(await form.locator('[name=comment]').inputValue(),'Keep this draft on error.');
    assert.equal(await form.locator('[type=submit]').isEnabled(),true);
    await context.unroute('**/api/comments');
    console.log('Passed: real comment publication, reload persistence, page isolation, XSS escaping, consent/required controls, failure draft preservation.');
    for (const width of [320,390,1440]) for (const theme of ['light','dark']) {
      await page.setViewportSize({width,height:844});
      for(const file of fs.readdirSync(root).filter(file=>file.endsWith('.html')&&fs.readFileSync(path.join(root,file),'utf8').includes('data-comments='))) {
        await go(file);
        await setTheme(theme);
        await page.locator('[data-comments]').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('[data-comments]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'comment overflow '+file+' '+width);
        assert.equal(await form.locator('[type=submit]').evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44}),true);
        checks++;
      }
      await go('notebook.html');
      await setTheme(theme);
      await page.locator('[data-comments]').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(os.tmpdir(),'aoai-comments-'+width+'-'+theme+'.png')});
    }
    console.log('Passed: 19 comment sections at three widths in both themes. Screenshots saved to '+os.tmpdir());
    console.log('Total layout/control cases: '+checks);
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve=>preview.server.close(resolve));
    preview.db.sql.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
