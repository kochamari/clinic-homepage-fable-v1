async (page) => {
  await page.context().route(/https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com)\//, route => route.abort());
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const run = async (name, fn) => {
    try { results.push({ name, pass: true, details: await fn() }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  };
  const base = 'http://127.0.0.1:4173';
  const paths = ['/', '/news', '/service', '/gastroscopy', '/lifestyle-disease', '/doctors', '/access', '/contact', '/privacy', '/facility-standards', '/404.html'];
  const go = async path => {
    await page.goto('about:blank');
    await page.goto(base + path);
    await page.waitForFunction(() => window.hgcScriptReady);
    await page.evaluate(() => document.fonts.ready);
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Text-node ranges test the rendered site, including CSS, rather than a copy of its logic.
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of paths) await run('site text layout ' + path + ' ' + width, async () => {
      await go(path);
      const layout = await page.evaluate(() => {
        const lines = [];
        const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          const el = node.parentElement;
          // Screen-reader-only labels have deliberately clipped ranges and are not visible ink.
          if (!node.textContent.trim() || el.closest('svg,script,style,[aria-hidden="true"],.visually-hidden') || !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) lines.push({ text: node.textContent.trim().slice(0, 55), x: r.x, y: r.y, right: r.right, bottom: r.bottom, scrollable: !!el.closest('.table-scroll') });
        }
        lines.sort((a,b) => a.y - b.y);
        const overlaps = [];
        for (let i=0; i<lines.length; i++) for (let j=i+1; j<lines.length && lines[j].y < lines[i].bottom - 2; j++) {
          const a=lines[i], b=lines[j];
          if (Math.min(a.right,b.right)-Math.max(a.x,b.x)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2) overlaps.push([a.text,b.text]);
        }
        return {
          documentWidth: document.documentElement.scrollWidth,
          overflows: lines.filter(r => !r.scrollable && (r.x < -1 || r.right > innerWidth + 1)),
          overlaps,
          clippedPrices: [...document.querySelectorAll('.price-table th,.price-table td')].filter(n => n.scrollWidth > n.clientWidth + 1 || n.getBoundingClientRect().right > innerWidth + 1).map(n=>n.innerText),
          clippedHours: [...document.querySelectorAll('.hours-table')].some(n => n.getBoundingClientRect().right > n.parentElement.getBoundingClientRect().right + 1),
          wrappedToday: [...document.querySelectorAll('.today-badge')].some(n => {const r=document.createRange();r.selectNodeContents(n);return r.getClientRects().length>1;}),
          navRows: [...document.querySelectorAll('.page-links a')].map(n => Math.round(n.getBoundingClientRect().top))
        };
      });
      check(layout.documentWidth <= width + 1, 'document overflow');
      check(!layout.overflows.length, 'text outside viewport: ' + JSON.stringify(layout.overflows));
      check(!layout.overlaps.length, 'overlapping text: ' + JSON.stringify(layout.overlaps));
      check(!layout.clippedPrices.length, 'price table clipped: ' + JSON.stringify(layout.clippedPrices));
      check(!layout.clippedHours && !layout.wrappedToday, 'hours table or today label does not fit');
      if (path === '/gastroscopy') check(new Set(layout.navRows).size === (width <= 700 ? 3 : 2), 'unbalanced gastroscopy menu');
      return { width, overlappingText: 0, clippedPrices: 0 };
    });
    await run('home navigation placement and unique destinations ' + width, async () => {
      await go('/');
      const links = page.locator('.hero-nav a');
      check(await links.count() === 4, 'expected four destinations');
      const hrefs = await links.evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
      check(JSON.stringify(hrefs) === JSON.stringify(['contact','#clinic-info','access','gastroscopy']), 'navigation destinations differ');
      for (const href of hrefs) check(await page.locator('.hero a[href="'+href+'"]').count() === 1, 'duplicate hero destination '+href);
      const positions = await links.evaluateAll(nodes => nodes.map(n => {const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
      check(new Set(positions.map(n=>n.y)).size === 2, 'hero links should form two rows');
      check(positions.every(n => n.height >= 56 && Math.abs(n.width-positions[0].width) <= 1), 'unequal or small targets');
      const card = await page.locator('.hero-card').boundingBox();
      if (width > 960) check(positions.every(n=>n.x+n.width < card.x), 'links not on the left');
      else check(positions.every(n=>n.y+n.height < card.y), 'links should precede phone card');
      await links.first().focus();
      for (let i=1;i<hrefs.length;i++) { await page.keyboard.press('Tab'); check(await links.nth(i).evaluate(n=>n===document.activeElement), 'keyboard order differs'); }
      return positions;
    });
  }
  for (const [href,destination] of [['contact','/contact'],['#clinic-info','/#clinic-info'],['access','/access'],['gastroscopy','/gastroscopy']]) await run('hero destination works '+href, async () => {
    await page.setViewportSize({width:375,height:1000});
    await go('/');
    await page.locator('.hero-nav a[href="'+href+'"]').press('Enter');
    await page.waitForURL(base+destination);
    await page.waitForFunction(()=>window.hgcScriptReady);
    if (href==='#clinic-info') {
      await page.waitForFunction(()=>{const r=document.querySelector('#clinic-info').getBoundingClientRect();return r.top>=0&&r.top<180;});
      check(await page.locator('[data-clinic-calendar]').count() > 0 || await page.locator('#clinic-calendar').count() > 0, 'calendar missing');
    }
  });
  // Also verify the hero after its real entrance animation, at mobile and desktop widths.
  for (const width of [375,1440]) await run('normal motion hero '+width, async () => {
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width,height:1000});
    await go('/');
    await page.waitForFunction(()=>document.documentElement.classList.contains('motion-ready'));
    await page.waitForFunction(()=>[...document.querySelectorAll('.hero-title .char-inner')].every(n=>getComputedStyle(n).transform==='matrix(1, 0, 0, 1, 0, 0)'));
    check(await page.locator('.hero-nav a').first().isVisible(), 'hero navigation hidden');
    check(await page.locator('.hero').evaluate(n=>getComputedStyle(n).overflowY==='clip'), 'photo can cover the fever notice');
    await page.screenshot({path:'/private/tmp/clinic-site-final-home-'+width+'.png'});
  });
  return {results,errors};
}
