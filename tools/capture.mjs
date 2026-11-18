import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Real Chromium renders, directly encoded as JPEG by the browser. No image edits.
const base=process.env.GAME_URL||'http://127.0.0.1:8080';
const debug=process.env.CDP_URL||'http://127.0.0.1:9224';
let localServer;
async function ensureServer() {
  try {if((await fetch(base)).ok)return;}catch{}
  const port=new URL(base).port||'8080';
  localServer=spawn(process.execPath,['serve.ts'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:port},stdio:'ignore'});
  process.on('exit',()=>localServer?.kill());
  for(let attempt=0;attempt<30;attempt++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
  throw new Error('Local server unavailable');
}
export async function openBrowser(url=base) {
  await ensureServer();
  const target=await (await fetch(debug+'/json/new?about:blank',{method:'PUT'})).json();
  const socket=new WebSocket(target.webSocketDebuggerUrl);let sequence=0;const pending=new Map(),events=[];
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const task=pending.get(message.id);if(task){pending.delete(message.id);message.error?task.reject(message.error):task.resolve(message.result);}}else events.push(message);};
  await new Promise(resolve=>socket.onopen=resolve);
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Page.bringToFront');
  await send('Emulation.setDeviceMetricsOverride',{width:960,height:600,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result?.value;};
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){if(await evaluate('Boolean(window.__shotReady)'))break;await new Promise(r=>setTimeout(r,250));}
  if(!await evaluate('Boolean(window.__shotReady)'))throw new Error('Game did not become ready: '+JSON.stringify(events.filter(e=>e.method==='Runtime.exceptionThrown')));
  return {send,evaluate,events,async close(){socket.close();await fetch(debug+'/json/close/'+target.id);}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  mkdirSync(new URL('../screenshots/',import.meta.url),{recursive:true});
  for(const [i,season] of ['spring','summer','autumn','winter'].entries()) {
    const browser=await openBrowser(base+'/?shot='+season);
    await new Promise(resolve=>setTimeout(resolve,600));
    const errors=browser.events.filter(e=>e.method==='Runtime.exceptionThrown');if(errors.length)throw new Error(JSON.stringify(errors));
    const screenshot=await browser.send('Page.captureScreenshot',{format:'jpeg',quality:65,fromSurface:true});
    const path=new URL(`../screenshots/${i+1}-${season}.jpg`,import.meta.url);
    const bytes=Buffer.from(screenshot.data,'base64');writeFileSync(path,bytes);
    console.log(season,bytes.length,await browser.evaluate('({season:solmara.game.env.season,weather:solmara.game.env.weather,draws:solmara.game.renderer.info.render.calls,triangles:solmara.game.renderer.info.render.triangles})'));
    await browser.close();
  }
}
