import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
assert.ok(process.argv.length > 2, 'Pass browser result JSON files');
let total=0;
for (const file of process.argv.slice(2)) {
  const data=JSON.parse(readFileSync(file,'utf8'));
  assert.ok(Array.isArray(data.results)&&data.results.length>0,file+': missing results');
  assert.deepEqual(data.errors,[],file+': unexpected page errors');
  for(const result of data.results)assert.equal(result.pass,true,file+': '+result.name+' '+(result.error||''));
  total+=data.results.length;
  console.log(file+': '+data.results.length+' passed');
}
console.log('Browser scenarios: '+total+' passed, 0 failed, 0 skipped');
