import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

export function environment(instant = '2026-09-14T10:00:00+09:00') {
  let now = new Date(instant).getTime();
  let nextId = 0;
  const timers = new Map();
  const events = { document: new Map(), window: new Map() };
  const host = () => { let html=''; return { get innerHTML(){return html;}, set innerHTML(value){html=value;this.writes++;}, className:'', writes:0 }; };
  const nodes = { status: host(), today: host(), calendar: host(), notes: host() };
  const classes = new Set();
  const classList = {add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n)};
  const on = scope => (name, callback) => { const list=events[scope].get(name)||[];list.push(callback);events[scope].set(name,list); };
  const context = vm.createContext({
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() {return now;} },
    Intl, URL, console,
    setTimeout(callback, delay=0) {const id=++nextId;timers.set(id,{callback,at:now+delay});return id;},
    clearTimeout(id) {timers.delete(id);},
    location: {protocol:'https:', hostname:'localhost',origin:'https://localhost',pathname:'/',hash:'',search:''},
    document: {
      hidden:false,readyState:'loading',documentElement:{classList},
      querySelector(selector) {return ({'[data-calendar-today]':nodes.today,'[data-closure-calendar]':nodes.calendar,'[data-closure-notes]':nodes.notes})[selector]||null;},
      querySelectorAll(selector) {return selector==='[data-clinic-status]'?[nodes.status]:[];},
      addEventListener:on('document'), removeEventListener(){},
    },
    addEventListener:on('window'),removeEventListener(){},
  });
  context.window = context;
  const run = (code,filename='fixture.js') => vm.runInContext(code,context,{filename});
  const load = file => run(source(file),file);
  function dispatch(scope,name,event={}) {for(const callback of events[scope].get(name)||[]) callback(event);}
  function advance(milliseconds) {
    const end=now+milliseconds;
    for(let turns=0;turns<10000;turns++) {
      const first=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!first) {now=end;return;}
      now=first[1].at;timers.delete(first[0]);first[1].callback();
    }
    throw new Error('Timer loop did not settle');
  }
  return {context,nodes,run,load,dispatch,advance,setTime:instant=>{now=new Date(instant).getTime();}};
}

export function clinic(instant, options={}) {
  const env=environment(instant);
  if(!options.noHelper) env.load('JS/date-utils.js');
  if(options.holidays!==null) env.run(options.holidays ?? source('JS/holidays-data.js'),'JS/holidays-data.js');
  if(Object.hasOwn(options,'news')) env.run('const newsData = '+options.news+';','news fixture');
  else env.load('JS/news-data.js');
  env.load('JS/clinic-hours.js');
  env.dispatch('document','DOMContentLoaded');
  return env;
}
export const plain = html => html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
