async(page)=>{
  const results=[];const errors=[];const browser=page.context().browser();const base='http://127.0.0.1:4173';
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const ga=/https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com)\//;
  async function run(name,opts,fn){let context;try{
    context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...opts});await context.route(ga,r=>r.abort());
    const p=await context.newPage();p.on('pageerror',e=>errors.push(name+': '+e.message));await p.bringToFront();await fn(p);results.push({name,pass:true});
  }catch(e){results.push({name,pass:false,error:e.message});}finally{if(context)await context.close();}}
  await run('JavaScript disabled preserves clinic info, hours and main content',{javaScriptEnabled:false},async(p)=>{
    for(const path of ['/','/gastroscopy','/contact','/access']){
      await p.goto(base+path);assert(await p.locator('h1').isVisible(),path+' title');
      const body=await p.locator('body').innerText();for(const text of ['原口消化器内科','0956-37-3777','9:00–12:30'])assert(body.includes(text),path+' missing '+text);
      assert(await p.locator('main').isVisible(),path+' main');
      if(path==='/gastroscopy')assert(await p.locator('.faq-a').first().isVisible(),'FAQ hidden without JS');
    }
  });
  await run('failed common script restores readable text and FAQ',{},async(p)=>{
    await p.route('**/JS/script.js',r=>r.abort());await p.goto(base+'/gastroscopy');
    await p.waitForFunction(()=>window.hgcMotionFallback===true&&!document.documentElement.classList.contains('js'));
    assert(await p.locator('.faq-a').first().isVisible(),'FAQ hidden on failure');
    assert(await p.locator('h1').evaluate(n=>getComputedStyle(n).opacity==='1'),'heading transparent');
    await p.locator('#gastro-fees').scrollIntoViewIfNeeded();assert(await p.locator('#gastro-fees').isVisible(),'fees hidden');
    assert((await p.locator('body').innerText()).includes('0956-37-3777'),'phone missing');
  });
  for(const file of ['holidays-data','news-data','date-utils'])await run('missing '+file+' shows unknown with static information',{},async(p)=>{
    await p.route('**/JS/'+file+'.js',r=>r.abort());
    for(const path of ['/#clinic-calendar','/contact']){
      await p.goto(base+path);await p.waitForFunction(()=>window.hgcScriptReady);
      const status=await p.locator('[data-clinic-status]').first().innerText();assert(status.includes('確認できません'),status);
      if(path.startsWith('/#')){assert((await p.locator('[data-calendar-today]').innerText()).includes('確認できません'),'calendar known');assert(await p.locator('.cal-cell.is-today, .hours-table .is-today-col, .today-badge').count()===0,'today marked');}
      const body=await p.locator('body').innerText();assert(body.includes('0956-37-3777')&&body.includes('9:00–12:30'),'static info missing');
    }
  });
  await run('practical destinations omit departure and arrival layers; ordinary motion remains',{reducedMotion:'no-preference'},async(p)=>{
    await p.goto(base+'/doctors');await p.waitForFunction(()=>window.hgcScriptReady);
    await p.evaluate(()=>{window.quickLink=document.querySelector('a[href="/#clinic-info"]');quickLink.addEventListener('click',e=>{window.quickLeaving=document.documentElement.classList.contains('is-leaving');e.preventDefault();},{once:true});quickLink.click();});
    assert(await p.evaluate(()=>quickLeaving===false),'hours departure layer');
    await p.locator('a[href="/#clinic-info"]').first().click();await p.waitForURL('**/#clinic-info');
    assert(await p.evaluate(()=>!document.documentElement.classList.contains('is-entering')),'hours arrival layer');
    await p.locator('.mobile-actions a[href="/access"]').click();await p.waitForURL('**/access');
    assert(await p.evaluate(()=>!document.documentElement.classList.contains('is-entering')),'access arrival layer');
    await p.goBack();await p.waitForTimeout(750);
    assert(await p.evaluate(()=>!document.documentElement.classList.contains('is-leaving')&&!document.documentElement.classList.contains('is-entering')),'back overlay');
    await p.goto(base+'/doctors');await p.waitForFunction(()=>window.hgcScriptReady);await p.waitForTimeout(700);
    await p.clock.install();await p.clock.pauseAt(new Date());
    await p.locator('.footer-nav a[href="service"]').first().dispatchEvent('click');
    assert(await p.evaluate(()=>document.documentElement.classList.contains('is-leaving')),'ordinary departure removed');
  });
  await run('reduced motion disables smooth scrolling and intro',{},async(p)=>{
    await p.goto(base+'/');await p.waitForFunction(()=>window.hgcScriptReady);
    assert(await p.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior==='auto'),'smooth scroll remains');
    assert(await p.locator('.curtain').count()===0,'intro remains');
  });
  return {results,errors};
}
