async(page)=>{
  const results=[];const errors=[];const browser=page.context().browser();
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
  const news=(id,extra={})=>({id,date:'2026-09-01',category:'テスト',title:id,content:'ローカル検証用の本文',...extra});
  const base='http://127.0.0.1:4173';
  async function run(name,options,fn){let context;try{
    context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',...options});
    await context.route(/https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com)\//,route=>route.abort());
    const p=await context.newPage();p.on('pageerror',e=>errors.push(name+': '+e.message));
    await p.bringToFront();await fn(p,context);results.push({name,pass:true});
  }catch(e){results.push({name,pass:false,error:e.message});}finally{if(context)await context.close();}}
  const inject=async(p,items)=>p.route('**/JS/news-data.js',route=>route.fulfill({contentType:'application/javascript',body:'const newsData = '+JSON.stringify({news:items})+';'}));
  const freeze=async(p,time)=>{await p.clock.install({time:new Date(time)});await p.clock.pauseAt(new Date(time));};
  const ready=async(p,path='/')=>{await p.goto(base+path);await p.waitForFunction(()=>window.hgcScriptReady);};
  await run('midnight news updates preserve retained node, focus and same-day scroll',{},async(p)=>{
    await inject(p,[news('keep'),news('expires',{displayUntil:'2026-09-14'}),news('starts',{displayFrom:'2026-09-15'})]);
    await freeze(p,'2026-09-14T23:59:59+09:00');await ready(p,'/news');
    assert(await p.locator('#news-expires').count()===1&&await p.locator('#news-starts').count()===0,'initial dates');
    await p.evaluate(()=>{window.keepNode=document.querySelector('#news-keep');keepNode.tabIndex=0;keepNode.focus();window.scrollTo(0,300);window.beforeScroll=scrollY;window.changes=0;new MutationObserver(list=>{window.changes+=list.length;}).observe(document.querySelector('[data-news-all]'),{childList:true,subtree:true});});
    await p.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));document.dispatchEvent(new Event('visibilitychange'));});
    assert(await p.evaluate(()=>changes===0&&keepNode===document.activeElement&&scrollY===beforeScroll),'same day DOM/focus/scroll changed');
    await p.clock.runFor(1100);
    assert(await p.locator('#news-expires').count()===0&&await p.locator('#news-starts').count()===1,'midnight dates');
    assert(await p.evaluate(()=>keepNode===document.querySelector('#news-keep')&&keepNode===document.activeElement),'retained node/focus lost');
  });
  await run('displayed popup expires at midnight and releases focus',{},async(p)=>{
    await inject(p,[news('expires',{popup:true,displayUntil:'2026-09-14',popupUntil:'2026-09-16'})]);
    await freeze(p,'2026-09-14T23:59:58+09:00');await ready(p);
    await p.locator('.header-tel').focus();
    await p.clock.runFor(700);assert(await p.locator('.news-popup.is-open').count()===1,'popup not shown');
    await p.clock.runFor(1800);assert(await p.locator('.news-popup').count()===0,'expired popup remains');
    assert(await p.evaluate(()=>!document.documentElement.classList.contains('is-popup-open')),'scroll locked');
  });
  await run('popup delay crosses midnight without expired flash',{},async(p)=>{
    await inject(p,[news('expires',{popup:true,popupUntil:'2026-09-14'})]);
    await freeze(p,'2026-09-14T23:59:59.800+09:00');await ready(p);
    await p.evaluate(()=>{window.popups=0;new MutationObserver(list=>{for(const m of list)for(const n of m.addedNodes)if(n.classList?.contains('news-popup'))window.popups++;}).observe(document.body,{childList:true});});
    await p.clock.runFor(2000);assert(await p.evaluate(()=>popups===0),'expired popup flashed');
  });
  await run('dismissed popup stays dismissed across tab, pageshow and midnight',{},async(p)=>{
    await inject(p,[news('keep',{popup:true,displayUntil:'2026-09-16'})]);
    await freeze(p,'2026-09-14T23:59:58+09:00');await ready(p);await p.clock.runFor(700);
    assert(await p.locator('.news-popup.is-open').count()===1,'initial popup');
    await p.keyboard.press('Escape');await p.clock.runFor(500);
    await p.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));document.dispatchEvent(new Event('visibilitychange'));});
    await p.clock.runFor(2000);assert(await p.locator('.news-popup').count()===0,'dismissed popup repeated');
  });
  for(const timezoneId of ['Asia/Tokyo','UTC','America/Los_Angeles','Pacific/Honolulu'])await run('Tokyo publication dates in '+timezoneId,{timezoneId},async(p)=>{
    await inject(p,[news('visible',{displayFrom:'2026-09-15',displayUntil:'2026-09-15'}),news('future',{displayFrom:'2026-09-16'})]);
    await freeze(p,'2026-09-15T00:01:00+09:00');await ready(p,'/news');
    assert(await p.locator('#news-visible time').innerText()==='2026.09.01','wrong displayed date');
    assert(await p.locator('#news-future').count()===0,'wrong publication day');
  });
  await run('reception status changes tomorrow to today at Tokyo midnight',{},async(p)=>{
    await freeze(p,'2026-09-14T23:59:59+09:00');await ready(p,'/#clinic-calendar');
    assert((await p.locator('[data-clinic-status]').first().innerText()).includes('明日'),'before midnight');
    await p.clock.runFor(1200);
    const text=await p.locator('[data-clinic-status]').first().innerText();
    assert(text.includes('開院前')&&text.includes('9:00から受付開始')&&!text.includes('明日'),'after midnight: '+text);
    assert((await p.locator('[data-calendar-today]').innerText()).includes('本日'),'calendar stale');
  });
  return {results,errors};
}
