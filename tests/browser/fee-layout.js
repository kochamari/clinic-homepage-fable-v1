async (page) => {
  await page.context().route(/https:\/\/(?:[^/]+\.)?(?:google-analytics\.com|googletagmanager\.com)\//,r=>r.abort());
  const results=[];const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const urls=['file:///Users/ko/Developer/clinic-homepage/gastroscopy.html#gastro-fees','http://127.0.0.1:4173/gastroscopy#gastro-fees'];
  for(const url of urls) for(const width of [375,390,768,1200,1440]) {
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.setViewportSize({width,height:950});
    await page.goto('about:blank');await page.goto(url);await page.waitForFunction(()=>window.hgcScriptReady);
    await page.locator('#gastro-fees').scrollIntoViewIfNeeded();
    const result=await page.evaluate(()=>{
      const fee=document.querySelector('#gastro-fees');
      const ink=node=>{const range=document.createRange();range.selectNodeContents(node);return range.getBoundingClientRect();};
      const notes=[fee.querySelector('.visit-note'),fee.nextElementSibling,fee.nextElementSibling.nextElementSibling];
      const gaps=notes.slice(1).map((node,index)=>ink(node).top-ink(notes[index]).bottom);
      const cells=[...fee.querySelectorAll('th,td')];
      const clipped=cells.some(node=>node.scrollWidth>node.clientWidth+1);
      return {url:location.protocol,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,gaps,clipped,caption:fee.querySelector('caption').innerText,priceSize:getComputedStyle(fee.querySelector('.price')).fontSize};
    });
    if(result.gaps.some(gap=>gap<20)||result.scrollWidth>width+1||result.clipped)throw new Error(JSON.stringify(result));
    results.push({name:'fee layout '+result.url+' '+width,pass:true,...result});
    if(url.startsWith('file:')&&(width===390||width===1200))await page.screenshot({path:'/private/tmp/clinic-fee-after-'+width+'.png'});
  }
  // 通常のスクロール演出を終えた後にも段落間隔を確認。
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1200,height:950});
  await page.goto(urls[0]);await page.locator('#gastro-fees').scrollIntoViewIfNeeded();await page.waitForTimeout(1800);
  await page.screenshot({path:'/private/tmp/clinic-fee-after-motion.png'});
  return {results,errors};
}
