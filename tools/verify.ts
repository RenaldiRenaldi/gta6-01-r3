import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildDossier, readGameTree, sourceImports, htmlFacts, resolveGamePath } from '../vendor/makefun-game.ts';

// Public-rule preflight, not the sealed scorer or a judge simulation.
const output=resolve(process.argv[2]||'out');
const caps={text_max_bytes:163840,screenshots:{max:4,max_bytes:262144},game_max_files:993,game_max_bytes:50331648,game_path_max_bytes:1000};
const tree=readGameTree(join(output,'game'),caps);
const files=new Set(tree.files.map(f=>f.path));
assert.ok(files.has('index.html'));assert.ok(statSync(join(output,'game/index.html')).size<=1048576);
console.log('PASS game_files',tree.count,'entries,',tree.totalBytes,'bytes');
let references=0;
function checkRef(ref:string,from:string){
  if(ref.startsWith('data:'))return;
  assert.ok(!/^(?:[a-z]+:|\/\/)/i.test(ref),'external reference '+ref);
  const path=ref.startsWith('/')?ref.slice(1):resolveGamePath(ref,from);
  assert.ok(path&&files.has(path),'missing or unsafe reference '+from+' -> '+ref);references++;
}
for(const file of tree.files){
  if(!/\.(?:js|mjs)$/.test(file.path))continue;
  const script=readFileSync(join(output,'game',file.path),'utf8');
  for(const ref of sourceImports(script))checkRef(ref,file.path);
  const parse=spawnSync(process.execPath,['--check',join(output,'game',file.path)],{encoding:'utf8'});
  assert.equal(parse.status,0,parse.stderr);
}
const html=htmlFacts(readFileSync(join(output,'game/index.html'),'utf8'));
for(const script of html.scripts)if(script.src)checkRef(script.src,'index.html');
for(const link of html.links)checkRef(link.href,'index.html');
assert.equal(html.importMaps.length,0);
assert.ok(tree.totalBytes < 48*1024*1024,'game exceeds the competition byte limit');
console.log('PASS references',references,'local references; all JavaScript parses');
function jpegSize(bytes:Buffer){
  assert.equal(bytes.readUInt16BE(0),0xffd8);assert.equal(bytes.readUInt16BE(bytes.length-2),0xffd9);
  let p=2;
  while(p<bytes.length){
    assert.equal(bytes[p++],255);while(bytes[p]===255)p++;
    const marker=bytes[p++];if(marker===0xd9||marker===0xda)break;
    const size=bytes.readUInt16BE(p);
    if([0xc0,0xc1,0xc2].includes(marker))return {width:bytes.readUInt16BE(p+5),height:bytes.readUInt16BE(p+3)};
    p+=size;
  }
  throw new Error('JPEG has no supported frame header');
}
const shots=readdirSync(join(output,'screenshots')).filter(n=>!n.startsWith('.')).sort();assert.equal(shots.length,4);
const shotInfo=shots.map(name=>{
  assert.match(name,/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
  const bytes=readFileSync(join(output,'screenshots',name)),size=jpegSize(bytes);
  assert.deepEqual(size,{width:960,height:600});assert.ok(bytes.length<=80000,name+' exceeds 80,000 bytes');
  return {name,bytes:bytes.length,...size};
});
console.log('PASS screenshots',JSON.stringify(shotInfo));
const expected=Buffer.from(buildDossier(output,caps)),actual=readFileSync(join(output,'dossier.json'));
assert.ok(actual.equals(expected),'dossier bytes differ');assert.ok(actual.length<=1572864);
const kit=resolve('../gta6-01-kit-v21/gta6-01-kit/starter/vendor/makefun-game.ts');
assert.ok(readFileSync('vendor/makefun-game.ts').equals(readFileSync(kit)),'helper differs from kit');
assert.equal(JSON.parse(readFileSync('.makefun/owner.json','utf8')).wallet,'9XAmKVSK2jKwExuis5E2WyrgsKx5F99gfuUrvbqXv52p');
console.log('PASS dossier_matches',actual.length,'bytes, SHA256',createHash('sha256').update(actual).digest('hex'));
console.log('4/4 public artifact checks passed. The sealed transcript gate and pairwise judge remain server-side.');
