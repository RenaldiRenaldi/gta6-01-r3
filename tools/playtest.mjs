import assert from 'node:assert/strict';
import { openBrowser } from './capture.mjs';

const browser=await openBrowser((process.env.GAME_URL||'http://127.0.0.1:8080')+'/');
const checks=[];
async function check(name,expression){const result=await browser.evaluate(expression);assert.equal(result,true,name+': '+JSON.stringify(result));checks.push(name);console.log('PASS',name);}
try {
  await check('boot and complete world',`(()=>{const g=solmara.game;g.started=true;g.paused=true;document.getElementById('screen').classList.add('hidden');return g.city.colliders.length>230&&g.traffic.length===48&&g.people.length===100;})()`);
  await check('building occlusion and clear road sight',`(()=>{const g=solmara.game,b=g.city.colliders[10];return !solmara.lineOfSight(g.city,{x:b.x-b.w-5,z:b.z,y:2},{x:b.x+b.w+5,z:b.z,y:2})&&solmara.lineOfSight(g.city,{x:0,z:-64,y:2},{x:0,z:64,y:2});})()`);
  await check('tail cannot complete by arrival',`(()=>{const g=solmara.game;g.mission.index=0;solmara.startMission(g);g.player.x=0;g.player.z=0;solmara.updateMission(g,.1);return g.mission.index===0&&g.mission.status==='active';})()`);
  await check('tail photograph needs twelve tracked seconds',`(()=>{const g=solmara.game,m=g.mission;g.player.x=0;g.player.z=-45;m.van.x=0;m.van.z=-10;for(let i=0;i<240&&m.progress<12;i++){g.player.x=m.van.x-Math.sin(m.van.heading)*35;g.player.z=m.van.z-Math.cos(m.van.heading)*35;solmara.updateMission(g,.1);}const old=g.input.take;g.input.take=k=>k==='p';solmara.updateMission(g,.1);g.input.take=old;return g.save.done===1&&m.index===1;})()`);
  await check('delivery rejects fast drive-through',`(()=>{const g=solmara.game;g.mission.index=1;solmara.startMission(g);g.car=g.garage[0];g.player.x=64;g.player.z=0;g.speed=30;solmara.updateMission(g,.1);return g.mission.routeIndex===0;})()`);
  await check('delivery has three drops then escape phase',`(()=>{const g=solmara.game;g.speed=0;for(const [x,z] of g.mission.stops){g.player.x=x;g.player.z=z;solmara.updateMission(g,.1);}return g.mission.phase===1&&g.mission.index===1;})()`);
  await check('mission timeout fails and retry resets',`(()=>{const g=solmara.game;g.mission.timer=.01;solmara.updateMission(g,.1);const failed=g.mission.status==='failed';solmara.startMission(g);return failed&&g.mission.status==='active'&&g.mission.timer===125;})()`);
  await check('all twelve jobs require gameplay',`(()=>{const g=solmara.game;for(let i=0;i<12;i++){g.mission.index=i;solmara.startMission(g);const t=solmara.missionTarget(g);g.player.x=t.x;g.player.z=t.z;g.player.y=0;solmara.updateMission(g,.05);if(g.mission.index!==i)return false;}return true;})()`);
  await check('combat bullets damage actual rivals',`(async()=>{const g=solmara.game;g.mission.index=2;solmara.startMission(g);g.car=null;g.flying=null;g.player.x=-128;g.player.z=-22;g.player.y=0;solmara.updateMission(g,.1);const e=g.combat.enemies[0];g.player.heading=Math.atan2(e.x-g.player.x,e.z-g.player.z);g.combat.weapon=2;g.save.ammo[2]=30;const hp=e.health;g.combat.cool=0;solmara.fireWeapon(g);return e.health<hp;})()`);
  await check('weapons hit mission van',`(()=>{const g=solmara.game;g.mission.index=3;solmara.startMission(g);g.car=null;g.player.x=g.mission.van.x;g.player.z=g.mission.van.z-18;g.player.y=0;g.player.heading=0;g.combat.weapon=2;g.combat.cool=0;g.save.ammo[2]=10;const hp=g.mission.van.health;solmara.fireWeapon(g);return g.mission.van.health<hp;})()`);
  await check('heist has guard gate and two distinct phases',`(()=>{const g=solmara.game;g.mission.index=11;solmara.startMission(g);g.player.x=128;g.player.z=256;g.car=null;solmara.updateMission(g,.1);const old=g.input.held;g.input.held=k=>k==='f';solmara.updateMission(g,1);const locked=g.mission.progress===0;g.combat.kills=6;solmara.updateMission(g,15);g.input.held=old;return locked&&g.mission.phase===1&&g.police.heat===5&&g.mission.index===11;})()`);
  await check('every remaining story success path reaches next job',`(()=>{
    const g=solmara.game,oldHeld=g.input.held;g.input.held=k=>k==='f';g.health=100;g.flying=null;
    const begin=i=>{g.mission.index=i;g.car=null;g.health=100;solmara.startMission(g);};
    const at=(x,z)=>{g.player.x=x;g.player.z=z;g.player.y=0;};
    begin(1);g.car=g.garage[0];g.speed=0;for(const p of g.mission.stops){at(...p);solmara.updateMission(g,.1);}g.police.heat=0;solmara.updateMission(g,.1);if(g.mission.index!==2)return 'delivery';
    begin(2);at(-128,0);solmara.updateMission(g,.1);g.combat.kills=4;solmara.updateMission(g,.1);if(g.mission.index!==3)return 'exchange';
    begin(3);g.mission.van.health=0;solmara.updateMission(g,.1);at(g.mission.casePoints[0].x,g.mission.casePoints[0].z);solmara.updateMission(g,.1);g.police.seen=false;solmara.updateMission(g,8.1);if(g.mission.index!==4)return 'intercept';
    begin(4);at(0,-64);solmara.updateMission(g,.1);g.combat.enemies.forEach(e=>e.alive=false);solmara.updateMission(g,25);if(g.mission.index!==5)return 'defend';
    begin(5);g.police.seen=false;solmara.updateMission(g,14.1);if(g.mission.index!==6)return 'escape';
    begin(6);g.flying=g.parkedHeli;g.speed=0;solmara.updateMission(g,.1);let pad=g.city.pads[1];Object.assign(g.player,pad);solmara.updateMission(g,6.1);pad=g.city.pads[0];Object.assign(g.player,pad);solmara.updateMission(g,6.1);g.flying=null;if(g.mission.index!==7)return 'extract';
    begin(7);at(64,-192);solmara.updateMission(g,12.1);if(g.mission.index!==8)return 'hack';
    begin(8);g.mission.van.health=0;solmara.updateMission(g,.1);for(const p of g.mission.casePoints){at(p.x,p.z);solmara.updateMission(g,.1);}g.police.seen=false;solmara.updateMission(g,10.1);if(g.mission.index!==9)return 'convoy';
    begin(9);at(0,64);solmara.updateMission(g,.1);g.combat.enemies.forEach(e=>e.alive=false);solmara.updateMission(g,17);g.combat.enemies.forEach(e=>e.alive=false);solmara.updateMission(g,18);if(g.mission.index!==10)return 'broadcast';
    begin(10);g.car=g.garage[0];for(const p of g.mission.stops){at(...p);solmara.updateMission(g,.1);}if(g.mission.index!==11)return 'run';
    begin(11);at(128,256);solmara.updateMission(g,.1);g.combat.kills=6;solmara.updateMission(g,15.1);at(0,-64);g.police.seen=false;g.police.lost=9;solmara.updateMission(g,.1);g.input.held=oldHeld;return g.mission.index===12&&g.save.done===12;
  })()`);
  await check('police see roads, search behind buildings, and roadblock',`(async()=>{
    const {updatePolice}=await import('./src/police.js'),{createCar}=await import('./src/actors.js'),g=solmara.game;
    solmara.clearPolice(g);g.player.x=0;g.player.z=0;g.player.y=0;g.police.heat=2;g.police.dispatch=100;g.police.lastSeen={x:0,z:0};g.env.weather='CLEAR';
    const c=createCar(g.scene,0,-60,0x33556a,'POLICE');Object.assign(c,{heading:0,route:[],repath:0});g.police.units.push(c);updatePolice(g,.02);const seen=g.police.seen;
    const b=g.city.colliders[15];Object.assign(c,{x:b.x-b.w-5,z:b.z,heading:Math.PI/2});g.player.x=b.x+b.w+5;g.player.z=b.z;updatePolice(g,.02);const hidden=!g.police.seen;
    g.player.x=0;g.player.z=0;g.player.heading=0;g.police.heat=5;g.police.blockTimer=0;g.speed=30;updatePolice(g,.02);const blocked=g.police.roadblocks.length>0;
    solmara.clearPolice(g);return seen&&hidden&&blocked;
  })()`);
  await check('weather and all four seasonal palettes',`(()=>{const g=solmara.game,colors=[];for(let i=0;i<4;i++){solmara.setSeason(g.env,g.scene,i);colors.push(g.city.groundMat.color.getHex());}return new Set(colors).size===4&&g.env.weather==='SNOWFALL';})()`);
  await check('side activities have physical collectible geometry',`(()=>{const g=solmara.game;return g.activities.packages.length===15&&g.city.ramps.length===3&&g.activities.raceSigns.length===3&&g.activities.rings.length>=7;})()`);
  await check('shop updates inventory and local saves',`(()=>{const g=solmara.game;g.shopOpen=true;g.save.cash=5000;g.purchase({id:'weapon1',price:750,name:'Breaker 12'});const s=JSON.parse(localStorage.getItem('twelve-debts-r3-v1'));return g.save.weapons.includes(1)&&g.save.ammo[1]>=24&&s.cash===4250;})()`);
  const errors=browser.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('ALL',checks.length,'BROWSER CHECKS PASSED');
} finally {await browser.close();}
