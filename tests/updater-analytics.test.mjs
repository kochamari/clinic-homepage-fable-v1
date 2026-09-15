import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseHolidays, readStoredDates, validateHolidays, serializeHolidays, updateHolidays } from '../scripts/update-holidays.mjs';
import { source, environment } from './browser-harness.mjs';

const dates = readStoredDates(source('JS/holidays-data.js'));
const currentYear = Number(dates.at(-1).slice(0,4));
const now = new Date(`${currentYear}-09-15T00:00:00+09:00`);
const header = '国民の祝日・休日月日,国民の祝日・休日名称\n';
const rows = values => values.map(date=>date.replaceAll('-','/')+',Holiday').join('\n')+'\n';
// CSV fixtures are encoded like the actual Cabinet Office response; production decoder is exercised.
const csv = values => Buffer.concat([Buffer.from('8d9196af82cc8f6a93fa81458b7893fa8c8e93fa2c8d9196af82cc8f6a93fa81458b7893fa96bc8fcc0a','hex'),Buffer.from(rows(values))]);
const response = (body=csv(dates),options={}) => new Response(body,{status:200,headers:{'content-type':'text/csv'},...options});

test('actual updater accepts complete current year without requiring unpublished next year',()=>{
  assert.equal(validateHolidays(dates,[],now).endYear,currentYear);
  assert.equal(parseHolidays(header+rows(dates)).length,dates.length);
});
for (const [label,input] of [
  ['HTML','<!doctype html><html>Unavailable</html>'],['empty',header],
  ['impossible date',header+'2026/2/30,Holiday'],['duplicate',header+'2026/1/1,Holiday\n2026/1/1,Holiday'],
  ['blank name',header+'2026/1/1, '],['malformed row',header+'bad data'],
]) test(`CSV rejects ${label}`,()=>assert.throws(()=>parseHolidays(input)));

test('coverage rejects incomplete years and missing prior records',()=>{
  assert.throws(()=>validateHolidays(dates.filter(d=>!d.startsWith('2000-')),[],now));
  assert.throws(()=>validateHolidays(dates.slice(0,-12),dates,now));
  assert.throws(()=>validateHolidays(dates.filter(d=>d!=='2026-09-22'),dates,now));
  assert.throws(()=>validateHolidays(dates.filter(d=>!d.startsWith(currentYear+'-')),[],now));
});

for (const [label,fetchImpl] of [
  ['HTTP error',async()=>response('unavailable',{status:503})],
  ['HTML content type',async()=>response('<html>error</html>',{headers:{'content-type':'text/html'}})],
  ['HTML with wrong content type',async()=>response('<html>error</html>')],
  ['invalid date',async()=>response(Buffer.concat([csv(dates),Buffer.from('2026/2/30,Holiday\n')]))],
  ['empty',async()=>response(csv([]))],
  ['only one record',async()=>response(csv(dates.slice(-1)))],
  ['missing previous holiday',async()=>response(csv(dates.filter(d=>d!=='2026-09-22')))],
  ['network failure',async()=>{throw new Error('simulated connection failure');}],
]) test(`update preserves original file on ${label}`,async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'clinic-holidays-'));
  try {
    const outputFile=path.join(dir,'holidays.js');
    const original=serializeHolidays(dates);
    await writeFile(outputFile,original);
    await assert.rejects(updateHolidays({fetchImpl,outputFile,now}));
    assert.equal(await readFile(outputFile,'utf8'),original);
    assert.deepEqual(await readdir(dir),['holidays.js']);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('update atomically replaces verified data, and identical input preserves file/mtime',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'clinic-holidays-'));
  try {
    const outputFile=path.join(dir,'holidays.js');
    await writeFile(outputFile,serializeHolidays(dates.filter(d=>!d.startsWith(currentYear+'-'))));
    const fetchImpl=async()=>response();
    assert.deepEqual(await updateHolidays({fetchImpl,outputFile,now}),{changed:true,count:dates.length});
    assert.equal(await readFile(outputFile,'utf8'),serializeHolidays(dates));
    const before=await stat(outputFile);
    assert.deepEqual(await updateHolidays({fetchImpl,outputFile,now}),{changed:false,count:dates.length});
    assert.equal((await stat(outputFile)).mtimeMs,before.mtimeMs);
    assert.deepEqual(await readdir(dir),['holidays.js']);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('updater refuses to overwrite malformed existing source',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'clinic-holidays-'));
  try {
    const outputFile=path.join(dir,'holidays.js');
    await writeFile(outputFile,'unexpected existing content');
    await assert.rejects(updateHolidays({fetchImpl:async()=>response(),outputFile,now}));
    assert.equal(await readFile(outputFile,'utf8'),'unexpected existing content');
  } finally {await rm(dir,{recursive:true,force:true});}
});

function analytics(url) {
  const env=environment();const inserted=[];
  env.context.location=new URL(url);
  env.context.document.getElementById=id=>inserted.find(script=>script.id===id);
  env.context.document.createElement=()=>({});
  env.context.document.head={appendChild:node=>inserted.push(node)}; // No requests leave this VM.
  env.load('JS/site-config.js');env.load('JS/analytics-consent.js');
  return {...env,inserted};
}
for(const url of ['http://localhost:4173/','http://127.0.0.1:4173/','file:///tmp/index.html',
  'https://009a8a76.clinic-homepage-fable-v1.pages.dev/','https://www.haraguchishoukakinaika.jp/',
  'https://haraguchishoukakinaika.jp.example.com/','https://evilharaguchishoukakinaika.jp/',
  'https://example.com/','http://haraguchishoukakinaika.jp/']) {
  test(`GA remains disabled at ${url}`,()=>{
    const env=analytics(url);assert.equal(env.inserted.length,0);assert.equal(env.context.dataLayer,undefined);
  });
}
test('exact HTTPS production host initializes once with existing privacy settings',()=>{
  const env=analytics('https://haraguchishoukakinaika.jp/contact?private=test#section');
  assert.equal(env.inserted.length,1);
  assert.equal(env.inserted[0].src,'https://www.googletagmanager.com/gtag/js?id=G-7ZLDWCR83Q');
  const config=env.context.dataLayer[1];
  assert.equal(config[1],'G-7ZLDWCR83Q');
  assert.deepEqual(JSON.parse(JSON.stringify(config[2])),{allow_google_signals:false,allow_ad_personalization_signals:false,page_location:'https://haraguchishoukakinaika.jp/contact'});
  env.load('JS/analytics-consent.js');assert.equal(env.inserted.length,1);assert.equal(env.context.dataLayer.length,2);
});
