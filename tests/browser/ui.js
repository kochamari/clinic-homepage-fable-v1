async (page) => {
  await page.context().route(/https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com)\//,route=>route.abort());
  await page.bringToFront();
  const results=[];const errors=[];
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const run=async(name,fn)=>{try{results.push({name,pass:true,details:await fn()});}catch(e){results.push({name,pass:false,error:e.message});}};
  page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:4173';
  const go=async(path)=>{const response=await page.goto(base+path);await page.waitForFunction(()=>window.hgcScriptReady);return response;};
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [375,390,768,1440]) await run('layout '+width,async()=>{
    await page.setViewportSize({width,height:900});
    const sizes=[];
    for(const path of ['/gastroscopy','/#clinic-calendar','/access','/contact','/doctors','/news']) {
      await go(path);
      const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      check(size.scroll<=size.width+1,path+' horizontal overflow '+JSON.stringify(size));sizes.push({path,...size});
    }
    return sizes;
  });
  await page.setViewportSize({width:390,height:844});
  await run('FAQ TOC opens, scrolls below header, keyboard and repeated hash',async()=>{
    await go('/gastroscopy');
    await page.locator('.page-links a[href="#gastro-preparation"]').click();
    await page.waitForFunction(()=>document.querySelector('#gastro-preparation .faq-q').getAttribute('aria-expanded')==='true');
    await page.waitForFunction(()=>{const r=document.querySelector('#gastro-preparation').getBoundingClientRect();return r.top>=0&&r.top<180;});
    const pos=await page.locator('#gastro-preparation').boundingBox();
    const header=await page.locator('.site-header').boundingBox();
    check(pos.y>=header.y+header.height-1,'FAQ hidden below fixed header');
    check(await page.locator('#gastro-preparation .faq-a').isVisible(),'answer not visible');
    await page.locator('#gastro-preparation .faq-q').press('Space');
    check(await page.locator('#gastro-preparation .faq-q').getAttribute('aria-expanded')==='false','Space fails');
    await page.locator('#gastro-preparation .faq-q').press('Enter');
    check(await page.locator('#gastro-preparation .faq-a').isVisible(),'Enter fails');
    await page.locator('#gastro-preparation .faq-q').press('Space');
    await page.locator('.page-links a[href="#gastro-preparation"]').click();
    check(await page.locator('#gastro-preparation .faq-a').isVisible(),'same hash remains closed');
    await go('/gastroscopy#gastro-preparation');
    check(await page.locator('#gastro-preparation .faq-a').isVisible(),'direct deep link remains closed');
    await page.waitForFunction(()=>document.querySelector('#gastro-preparation').getBoundingClientRect().top<180);
    await page.screenshot({path:'/private/tmp/clinic-review-faq-390.png'});
    return {top:pos.y,headerBottom:header.y+header.height};
  });
  for(const motion of ['reduce','no-preference']) await run('mobile menu keyboard, focus restoration, navigation and back: '+motion,async()=>{
    await page.emulateMedia({reducedMotion:motion});
    await go('/gastroscopy');const toggle=page.locator('.nav-toggle');
    await toggle.focus();await toggle.press('Enter');
    check(await toggle.getAttribute('aria-expanded')==='true','menu not open');
    await page.waitForFunction(()=>document.activeElement.closest('.drawer'));
    await page.keyboard.press('Tab');
    check(await page.evaluate(()=>!!document.activeElement.closest('.drawer')||document.activeElement.matches('.nav-toggle')),'focus escaped menu');
    await page.keyboard.press('Escape');
    check(await toggle.getAttribute('aria-expanded')==='false','Escape fails');
    check(await toggle.evaluate(node=>node===document.activeElement),'focus not restored');
    await toggle.press('Space');await page.locator('.drawer a[href="access"]').click();
    await page.waitForURL('**/access');await page.waitForFunction(()=>window.hgcScriptReady);
    await page.goBack();await page.waitForFunction(()=>window.hgcScriptReady);
    check(await toggle.getAttribute('aria-expanded')==='false','back left menu open');
    check(await page.evaluate(()=>!document.documentElement.classList.contains('is-leaving')&&!document.querySelector('main').inert),'back left hidden/inert content');
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await run('parking enlargement keyboard and phone links without calling',async()=>{
    await go('/access');
    for(const trigger of await page.locator('.parking-zoom-trigger').all()) {
      await trigger.focus();await trigger.press('Enter');
      await page.waitForFunction(()=>!document.querySelector('.image-lightbox').hidden&&document.querySelector('.image-lightbox').classList.contains('is-open'));
      check(await page.locator('.image-lightbox').isVisible(),'lightbox not open');
      await page.locator('.image-lightbox-canvas').press('Space');
      check(await page.locator('.image-lightbox-canvas').evaluate(n=>n.classList.contains('is-zoomed')),'zoom fails');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('.image-lightbox').hidden);
      check(await trigger.evaluate(n=>n===document.activeElement),'lightbox focus not restored');
    }
    const phones=await page.locator('a[href^="tel:"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
    check(phones.length>0&&phones.every(h=>h.replace(/-/g,'')==='tel:0956373777'),'telephone differs');
    await page.evaluate(()=>document.addEventListener('click',event=>{const a=event.target.closest('a[href^="tel:"]');if(a){window.testTelephone=a.getAttribute('href');event.preventDefault();event.stopImmediatePropagation();}},true));
    await page.locator('.mobile-actions-call').click();
    check(await page.evaluate(()=>window.testTelephone==='tel:0956-37-3777'),'phone blocked');
  });
  await run('deep 404 responses/resources/menu/recovery',async()=>{
    const details=[];
    for(const path of ['/not-a-page','/missing/deep/page','/missing/deep/']){
      const failures=[];const handler=response=>{if(response.status()>=400&&!response.request().isNavigationRequest())failures.push(response.url());};
      page.on('response',handler);const response=await go(path);
      check(response.status()===404,'wrong HTTP status');
      check(await page.locator('.brand-mark').evaluate(n=>n.complete&&n.naturalWidth>0),'logo missing');
      check(failures.length===0,'404 resources failed '+failures.join(','));
      const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).filter(h=>!h.startsWith('#')&&!/^\w+:/.test(h)));
      check(links.every(h=>h.startsWith('/')),'relative recovery link');
      await page.locator('.nav-toggle').click();await page.keyboard.press('Escape');
      await page.locator('main a[href="/"]').click();await page.waitForURL(base+'/');
      await go(path);await page.locator('main a[href="/service"]').click();await page.waitForURL('**/service');
      details.push({path,status:response.status(),resourceFailures:failures});page.off('response',handler);
    }
    return details;
  });
  await run('fee table and calendar screenshots',async()=>{
    await go('/gastroscopy#gastro-fees');await page.locator('#gastro-fees').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);await page.screenshot({path:'/private/tmp/clinic-review-fees-390.png'});
    await page.setViewportSize({width:1440,height:1000});await go('/#clinic-calendar');await page.locator('[data-calendar-today]').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);await page.screenshot({path:'/private/tmp/clinic-review-calendar-1440.png'});
    check(await page.locator('#hgc-google-analytics').count()===0,'GA injected locally');
  });
  return {results,errors};
}
