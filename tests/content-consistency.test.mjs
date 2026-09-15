import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { source, root, clinic, plain } from './browser-harness.mjs';
const pages=readdirSync(root).filter(file=>file.endsWith('.html'));
const jsonld=file=>[...source(file).matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
const visible=file=>plain(source(file).replace(/<script\b[\s\S]*?<\/script>/g,''));
function walk(value,fn){if(!value||typeof value!=='object')return;fn(value);for(const child of Object.values(value))walk(child,fn);}

test('all page telephone links and JSON-LD clinic telephones agree',()=>{
  for(const file of pages){
    const phones=[...source(file).matchAll(/href="tel:([^"]+)"/g)];assert.ok(phones.length,file);
    for(const [,phone] of phones)assert.equal(phone.replaceAll('-',''),'0956373777',file);
    for(const data of jsonld(file))walk(data,node=>{if(node.telephone)assert.equal(node.telephone.replace(/[\s+-]/g,''),'81956373777',file);});
  }
});
test('opening hours in actual JSON-LD, visible table and status boundaries agree',()=>{
  const spec=jsonld('index.html')[0].openingHoursSpecification;
  const actual={};for(const item of spec)for(const day of [item.dayOfWeek].flat())(actual[day]??=[]).push(item.opens+'–'+item.closes);
  const full=['09:00–12:30','14:00–17:30'];
  assert.deepEqual(actual,{Monday:full,Tuesday:full,Thursday:full,Friday:full,Wednesday:['09:00–12:00'],Saturday:['09:00–12:30']});
  const home=visible('index.html');assert.match(home,/9:00[–〜]12:30/);assert.match(home,/14:00[–〜]17:30/);assert.match(home,/水曜.*12:00/);
  assert.match(plain(clinic('2026-09-16T12:00:00+09:00').nodes.status.innerHTML),/受付終了/);
  assert.match(plain(clinic('2026-09-19T12:30:00+09:00').nodes.status.innerHTML),/受付終了/);
});
test('all scripts using scheduling/news load date and data dependencies in order',()=>{
  for(const file of pages){const html=source(file);if(!/src="JS\/(clinic-hours|news-loader|news-popup)\.js"/.test(html))continue;
    for(const dependency of ['date-utils','news-data'])assert.ok(html.indexOf('JS/'+dependency+'.js')>=0,file+' missing '+dependency);
    const firstConsumer=Math.min(...['clinic-hours','news-loader','news-popup'].map(name=>html.indexOf('JS/'+name+'.js')).filter(n=>n>=0));
    assert.ok(html.indexOf('JS/date-utils.js')<firstConsumer,file);assert.ok(html.indexOf('JS/news-data.js')<firstConsumer,file);
    if(html.includes('JS/clinic-hours.js'))assert.ok(html.indexOf('JS/holidays-data.js')>=0&&html.indexOf('JS/holidays-data.js')<html.indexOf('JS/clinic-hours.js'),file);
  }
});
test('provided services use service types supported by Schema.org, with visible supporting content',()=>{
  const services=jsonld('index.html')[0].availableService;
  assert.ok(services.length>0);
  for(const service of services)assert.ok(['MedicalProcedure','MedicalTest','MedicalTherapy'].includes(service['@type']),service.name);
  assert.ok(services.some(service=>service['@type']==='MedicalTherapy'&&service.name==='生活習慣病の食事・運動療法'));
  assert.match(visible('lifestyle-disease.html'),/食事/);assert.match(visible('lifestyle-disease.html'),/運動/);
});
test('screening base fees, sedation fee, period and computed totals agree across pages and FAQ JSON-LD',()=>{
  const gastro=visible('gastroscopy.html'),service=visible('service.html');
  const faq=jsonld('gastroscopy.html').find(data=>data['@type']==='FAQPage').mainEntity.find(q=>q.name==='佐世保市の胃がん検診は受けられますか？').acceptedAnswer.text;
  for(const text of [gastro,service,faq]){
    assert.match(text,/30[〜～]69歳.*3,000円/);assert.match(text,/70歳以上.*1,500円/);
    assert.match(text,/2027年1月/);assert.match(text,/3,300円/);
  }
  const serviceRow=source('service.html').match(/<th scope="row" class="exam-name">胃がん検診（胃カメラ）([\s\S]*?)<\/tr>/)[1];
  assert.deepEqual([...serviceRow.matchAll(/<td class="price">([\d,]+)円<\/td>/g)].map(m=>Number(m[1].replaceAll(',',''))),[3000,1500]);
  const table=source('gastroscopy.html').match(/<table class="price-table screening-fee-table">([\s\S]*?)<\/table>/)[1];
  const rows=[...table.matchAll(/<tr><th scope="row">([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length,3);
  const expected=[0,3000,1500];
  for(let index=0;index<rows.length;index++){
    const prices=[...rows[index][1].matchAll(/<td class="price">([\d,]+)円<\/td>/g)].map(m=>Number(m[1].replaceAll(',','')));
    assert.deepEqual(prices,[expected[index],expected[index]+3300]);
  }
  assert.match(plain(table),/2027年1月以降の検査/);assert.match(gastro,/令和8年度の検診基本料金/);assert.match(plain(rows[0][1]),/年齢区分より優先/);
  assert.match(gastro,/別途必要な検査・診療等の費用は含みません/);assert.match(gastro,/2027年4月以降/);
  for(const text of [gastro,service,faq])for(const condition of [/住民票/,/職場/,/年度内.*1回/])assert.match(text,condition);
  const guidance=faq.match(/症状[^。]*。電話予約時[^。]*。/)[0];
  const screening=source('gastroscopy.html').match(/id="gastro-checkup"[\s\S]*?<\/section>/)[0];
  const visibleFaq=source('gastroscopy.html').match(/<p class="faq-q">佐世保市の胃がん検診は受けられますか？<\/p>[\s\S]*?<\/div>/)[0];
  const serviceScreening=source('service.html').match(/<p>胃がん検診は、[\s\S]*?<\/p>/)[0];
  for(const content of [screening,visibleFaq,serviceScreening])assert.ok(plain(content).includes(guidance),'screening guidance must agree with FAQ JSON-LD');
});
test('booking policy remains telephone booking for gastroscopy, including regular patients',()=>{
  const html=visible('gastroscopy.html');
  const faq=jsonld('gastroscopy.html').find(data=>data['@type']==='FAQPage').mainEntity.find(q=>q.name==='予約は必要ですか？').acceptedAnswer.text;
  for(const text of [html,faq]){assert.match(text,/定期的に通院されている方も含めて/);assert.match(text,/事前.*予約.*必要/);assert.match(text,/電話/);}
  for(const file of ['index.html','contact.html','service.html']){const text=visible(file);assert.match(text,/通常の診察.*予約不要/,file);assert.match(text,/胃カメラ.*電話|電話.*胃カメラ/,file);}
  assert.match(visible('contact.html'),/現金のみ/);
});
test('404 resource and navigation references resolve from the root',()=>{
  for(const [,attribute,url] of source('404.html').matchAll(/\b(href|src)="([^"]+)"/g)){
    if(url.startsWith('#')||/^[a-z][a-z\d+.-]*:/i.test(url))continue;
    assert.ok(url.startsWith('/'),attribute+'='+url);
  }
});
