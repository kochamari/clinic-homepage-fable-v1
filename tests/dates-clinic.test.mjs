import test from 'node:test';
import assert from 'node:assert/strict';
import { environment,clinic,plain,source } from './browser-harness.mjs';
import { readStoredDates,serializeHolidays,coverageOf } from '../scripts/update-holidays.mjs';

const cases=[
  ['2026-09-14T08:59:59+09:00','開院前','受付開始前です'],
  ['2026-09-14T09:00:00+09:00','診療中','ただいま診療中です'],
  ['2026-09-14T12:29:59+09:00','診療中','本日 9月14日'],
  ['2026-09-14T12:30:00+09:00','休憩中','14:00から受付再開'],
  ['2026-09-14T14:00:00+09:00','診療中','本日 9月14日'],
  ['2026-09-14T17:30:00+09:00','本日の受付終了','明日 9月15日'],
  ['2026-09-16T11:59:59+09:00','診療中','本日は午前のみ'],
  ['2026-09-16T12:00:00+09:00','本日の受付終了','明日 9月17日'],
  ['2026-09-19T12:29:59+09:00','診療中','本日 9月19日'],
  ['2026-09-19T12:30:00+09:00','本日の受付終了','次の診療：9月24日'],
  ['2026-10-04T10:00:00+09:00','本日休診','明日 10月5日'],
  ['2026-11-03T10:00:00+09:00','本日休診','明日 11月4日'],
];
for(const [instant,status,today] of cases) test('受付境界 '+instant,()=>{
  const env=clinic(instant);assert.ok(plain(env.nodes.status.innerHTML).includes(status));assert.ok(plain(env.nodes.today.innerHTML).includes(today));
});

test('通常土曜と第4土曜の担当医、翌日の二名体制',()=>{
  assert.match(plain(clinic('2026-09-12T10:00+09:00').nodes.today.innerHTML),/原口 紘/);
  const fourth=plain(clinic('2026-09-26T10:00+09:00').nodes.today.innerHTML);
  assert.match(fourth,/小田 英俊/);assert.doesNotMatch(fourth,/原口/);
  const tomorrow=plain(clinic('2026-09-14T18:00+09:00').nodes.today.innerHTML);
  assert.match(tomorrow,/原口 増穂/);assert.match(tomorrow,/原口 紘/);
});

test('掲載期限と診療適用日は別：休診・担当医変更は一覧期限後も適用',()=>{
  const item={date:'2026-09-01',displayUntil:'2026-09-02',closures:[{date:'2026-09-14'}],doctorChanges:[{date:'2026-09-15',doctors:['変更担当医']}]};
  const news=JSON.stringify({news:[item]});
  assert.match(plain(clinic('2026-09-14T10:00+09:00',{news}).nodes.status.innerHTML),/本日休診/);
  assert.match(plain(clinic('2026-09-15T10:00+09:00',{news}).nodes.today.innerHTML),/変更担当医/);
});

test('正しく取得した空のお知らせは通常スケジュールを判定できる',()=>{
  assert.match(clinic('2026-09-14T10:00+09:00',{news:'{news:[]}'}).nodes.status.className,/is-open/);
});

const badNews=['undefined','null','{}','{news:null}','{news:[null]}','{news:[,]}','{news:[{date:"2026-09-01",closures:{}}]}','{news:[{date:"2026-09-01",closures:[,]}]}','{news:[{date:"2026-09-01",closures:[{date:"2026-02-30"}]}]}','{news:[{date:"2026-09-01",doctorChanges:[{date:"2026-09-14",doctors:[]}]}]}','{news:[{date:"2026-09-01",doctorChanges:[,]}]}'];
for(const news of badNews) test('診療データ不正を不明として案内：'+news,()=>{
  const env=clinic('2026-09-14T10:00+09:00',{news});
  assert.match(env.nodes.status.className,/is-unknown/);assert.match(plain(env.nodes.today.innerHTML),/確認できません/);
  assert.doesNotMatch(env.nodes.calendar.innerHTML,/cal-cell|is-today/);
  assert.doesNotMatch(plain(env.nodes.status.innerHTML),/診療中|本日休診|次の受付は明日/);
});

test('祝日欠落・不正・件数不一致・共通ヘルパー欠落を不明として案内',()=>{
  const original=source('JS/holidays-data.js');
  for(const options of [{holidays:null},{holidays:'const nationalHolidays=[];'},{holidays:original.replace("'2026-09-21'","'2026-02-30'")},{holidays:original.replace("    '2026-09-21',\n",'')},{noHelper:true}]) {
    const env=clinic('2026-09-14T10:00+09:00',options);assert.match(env.nodes.status.className,/is-unknown/);
  }
});

test('収録年の12月は範囲内、翌年は不明、年末の次回受付を推測しない',()=>{
  const year=coverageOf(readStoredDates(source('JS/holidays-data.js'))).endYear;
  assert.doesNotMatch(clinic(`${year}-12-01T10:00+09:00`).nodes.status.className,/unknown/);
  assert.match(clinic(`${year+1}-01-04T10:00+09:00`).nodes.status.className,/unknown/);
  const end=clinic(`${year}-12-31T20:00+09:00`);
  assert.match(plain(end.nodes.today.innerHTML),/明日の診療予定を確認できません/);
  assert.doesNotMatch(plain(end.nodes.today.innerHTML),/担当医|明日は休診です/);
});

test('開いたまま17:30・深夜・タブ復帰・pageshowで更新する',()=>{
  const env=clinic('2026-09-14T17:29:41+09:00');env.advance(18999);assert.match(env.nodes.status.className,/is-open/);
  env.advance(1);assert.match(env.nodes.status.className,/is-after/);
  env.setTime('2026-09-15T00:00:00+09:00');env.dispatch('window','pageshow');assert.match(plain(env.nodes.today.innerHTML),/本日 9月15日/);
  env.setTime('2026-09-15T18:00:00+09:00');env.dispatch('document','visibilitychange');assert.match(plain(env.nodes.today.innerHTML),/明日 9月16日/);
  const midnight=clinic('2026-09-30T23:59:41+09:00');midnight.advance(19000);assert.match(plain(midnight.nodes.calendar.innerHTML),/2026年10月/);assert.doesNotMatch(plain(midnight.nodes.calendar.innerHTML),/2026年9月/);
});

test('掲載可否・掲載日の表示は東京・UTC・LA・ホノルルで一致',()=>{
  const original=process.env.TZ;
  try {for(const tz of ['Asia/Tokyo','UTC','America/Los_Angeles','Pacific/Honolulu']) {
    process.env.TZ=tz;const env=environment('2026-09-14T15:00:00Z');env.load('JS/date-utils.js');const date=env.context.HGCDate;
    assert.equal(date.today(),'2026-09-15');assert.equal(date.formatDate('2026-09-15'),'2026.09.15');
    assert.equal(date.visible({date:'2026-09-01',displayFrom:'2026-09-15',displayUntil:'2026-09-15'}),true);
  }} finally {if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});

test('開始日・終了日・popupUntilの全条件、未指定・不正日付を判定',()=>{
  const env=environment();env.load('JS/date-utils.js');const d=env.context.HGCDate;
  const item={date:'2026-09-01',displayFrom:'2026-09-14',displayUntil:'2026-09-16',popup:true,popupUntil:'2026-09-15'};
  for(const [day,visible,popup] of [['2026-09-13',false,false],['2026-09-14',true,true],['2026-09-15',true,true],['2026-09-16',true,false],['2026-09-17',false,false]]) {
    assert.equal(d.visible(item,day),visible);assert.equal(d.popupVisible(item,day),popup);
  }
  assert.equal(d.popupVisible({date:'2026-09-01',popup:true},'2026-09-15'),true);
  for(const invalid of ['2026-02-30','2026-13-01','2026-9-15','',null]) {
    assert.equal(d.visible({...item,displayUntil:invalid},'2026-09-15'),false);
    assert.equal(d.popupVisible({...item,popupUntil:invalid},'2026-09-15'),false);
  }
  assert.equal(d.visible({...item,displayFrom:'2026-09-17'},'2026-09-15'),false);
  assert.equal(d.popupVisible({...item,popup:false},'2026-09-15'),false);
  assert.equal(d.formatDate('2026-02-30'),'');
});

test('news-loaderも本体の共通条件・日付表示を呼ぶ',()=>{
  const env=environment('2026-09-15T23:59:59+09:00');env.load('JS/date-utils.js');
  env.run('const newsData={news:[{id:1,date:"2026-09-01",displayUntil:"2026-09-15"},{id:2,date:"2026-09-02",displayFrom:"2026-09-16"}]};');
  env.load('JS/news-loader.js');assert.equal(env.run('visibleNewsItems()[0].id'),1);assert.equal(env.run('formatDate("2026-09-01")'),'2026.09.01');
  env.setTime('2026-09-16T00:00:00+09:00');assert.equal(env.run('visibleNewsItems()[0].id'),2);
});

test('popup本体はnullのお知らせやヘルパー欠落でも例外にならない',()=>{
  for(const noHelper of [true,false]) {
    const env=environment();if(!noHelper)env.load('JS/date-utils.js');env.run('const newsData=null;');env.load('JS/news-popup.js');
    assert.doesNotThrow(()=>env.dispatch('document','DOMContentLoaded'));
  }
});

test('受付状態が変わらない毎分更新で同じ案内を再挿入しない',()=>{
  const env=clinic('2026-09-14T10:00:00+09:00');
  const before=[env.nodes.status.writes,env.nodes.today.writes];
  env.advance(5*60*1000);
  env.dispatch('window','pageshow',{persisted:true});
  assert.deepEqual([env.nodes.status.writes,env.nodes.today.writes],before);
});
