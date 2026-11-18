import * as T from '../vendor/three.module.min.js';
import { SEASONS, WEAPONS, SERVICES, clamp, distance, district } from './config.js';
import { buildCity, moveOnStreets, surfaceHeight, lineOfSight } from './city.js';
import { createCar, createHelicopter, createPerson, populateStreets, posePerson, driveCar, flyHelicopter, updateTraffic, createCombat, updateCombat, fireWeapon, syncCar, spawnRivals } from './actors.js';
import { createPolice, reportCrime, updatePolice, clearPolice } from './police.js';
import { createEnvironment, setSeason, updateEnvironment } from './environment.js';
import { createMissions, startMission, updateMission, missionTarget, JOBS, failMission } from './missions.js';
import { createActivities, updateActivities } from './activities.js';
import { createInterface } from './interface.js';
import { loadSave, freshSave, saveGame } from './storage.js';
import { bootAudio, tickAudio, tone, toggleSound } from './audio.js';

const params=new URLSearchParams(location.search),shot=params.get('shot');
const canvas=document.getElementById('world');
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(57,innerWidth/innerHeight,.15,1500);
const city=buildCity(scene),population=populateStreets(scene);
const keys=new Set(),presses=new Set();
const input={held:k=>keys.has(k),take:k=>{const found=presses.has(k);presses.delete(k);return found;}};
window.addEventListener('keydown',event=>{
  const key=event.key.toLowerCase();if(!keys.has(key))presses.add(key);keys.add(key);
  if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(key))event.preventDefault();
});
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();presses.clear();});
let mouseDown=false;
canvas.addEventListener('mousedown',()=>{if(!game.started)return;mouseDown=true;bootAudio();if(!document.pointerLockElement&&!game.shot)canvas.requestPointerLock?.();});
window.addEventListener('mouseup',()=>mouseDown=false);
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===canvas&&!game.car&&!game.flying)game.player.heading-=e.movementX*.003;
});
const initialSave=shot?freshSave():loadSave();
export const game={
  scene,camera,renderer,city,input,save:initialSave,shot,
  player:{x:0,z:-64,y:0,heading:0},avatar:createPerson(scene,0,-64),
  traffic:population.traffic,people:population.people,police:createPolice(),combat:createCombat(scene),
  car:null,flying:null,parkedHeli:createHelicopter(scene,-256,192),health:100,speed:0,time:0,started:false,paused:false,shopOpen:false,
  radioOn:true,dj:'Niko: Pearl Street, the lights are on. Ines has a job for you. J opens her briefing.',djTime:10,
  shake:0,slow:0,hitmark:0,muzzle:0,inCover:false,mapLarge:false,cameraSnap:true,
  district(){return district(this.player);},
  notify(text,seconds){this.ui?.notify(text,seconds);},
  radioMessage(text,seconds=8){this.dj=text;this.djTime=seconds;},
  commitCrime(kind,amount){reportCrime(this,kind,amount);},
  damage(amount){this.health=clamp(this.health-amount*(this.save.upgrades.includes('armor')?.7:1),0,100);if(amount>1)this.shake=.06;},
  acceptJob(){if(this.mission.status==='briefing'||this.mission.status==='failed'){if(this.ui.briefOpen)startMission(this);else this.ui.showBrief(this.mission.status==='failed');}},
  toggleShop(force){this.shopOpen=typeof force==='boolean'?force:!this.shopOpen;document.getElementById('shop').classList.toggle('hidden',!this.shopOpen);if(this.shopOpen){document.exitPointerLock?.();this.ui.closeBrief();}},
  purchase(good){
    if(!good||!this.shopOpen)return;
    if(this.save.cash<good.price){this.notify('YOUR CASH DOES NOT COVER THAT');return;}
    if(good.id==='repaint'&&this.police.seen){this.notify('LOSE VISUAL CONTACT BEFORE REPAINTING');return;}
    if(['engine','nos'].includes(good.id)&&this.save.upgrades.includes(good.id)){this.notify('ALREADY FITTED TO YOUR GARAGE');return;}
    this.save.cash-=good.price;
    if(good.id.startsWith('weapon')){const i=Number(good.id.at(-1));if(!this.save.weapons.includes(i))this.save.weapons.push(i);this.save.ammo[i]+=WEAPONS[i].rounds;this.combat.weapon=i;}
    else if(good.id==='armor'){if(!this.save.upgrades.includes('armor'))this.save.upgrades.push('armor');this.health=100;for(const c of this.garage)c.health=150;}
    else if(good.id==='repaint'){for(const c of this.garage)c.paint.color.setHex([0x83bbad,0xe4bd7f,0x947795][Math.floor(this.time)%3]);clearPolice(this);}
    else this.save.upgrades.push(good.id);
    saveGame(this.save);tone(660,.16);this.notify('CREW PURCHASE / '+good.name.toUpperCase());
  },
  contextPrompt(){
    if(this.shopOpen)return 'E CLOSE / PURCHASES SAVE AUTOMATICALLY';
    if(this.flying)return 'HELICOPTER / W S THRUST · A D YAW · H / SPACE LIFT · CTRL LOWER · E LAND';
    const service=SERVICES.find(s=>s.kind!=='heli'&&distance(s,this.player)<10);
    if(service)return service.kind==='safe'?'E SAFEHOUSE / SAVE + RECOVER · J STORY JOB':'E '+service.name.toUpperCase()+' / WEAPONS + UPGRADES';
    if(this.car)return 'WASD DRIVE · SHIFT NOS · SPACE HANDBRAKE · E EXIT · C RACE AT AMBER FLAGS';
    return 'WASD MOVE · E ENTER / INTERACT · CLICK FIRE · Q COVER · J JOB · F HOLD HACK · P PHOTO';
  },
};
game.env=createEnvironment(scene,city);setSeason(game.env,scene,initialSave.season||0);game.env.hour=initialSave.hour||17.2;
game.garage=[createCar(scene,2,-57,0xd76a5d,'MARINER GT'),createCar(scene,13,-75,0x63b6b2,'CORA SPORT')];
game.mission=createMissions(game);game.activities=createActivities(game);game.ui=createInterface(game);

const beacon=new T.Mesh(new T.CylinderGeometry(.3,.75,9,12,1,true),new T.MeshBasicMaterial({color:0x8affda,transparent:true,opacity:.28,side:T.DoubleSide,depthWrite:false}));scene.add(beacon);
const targetRing=new T.Mesh(new T.TorusGeometry(4,.1,5,40),new T.MeshBasicMaterial({color:0x91fce0}));targetRing.rotation.x=Math.PI/2;scene.add(targetRing);
function startGame(){
  bootAudio();game.started=true;game.paused=false;document.getElementById('screen').classList.add('hidden');
  game.notify('WELCOME HOME / E FOR YOUR MARINER · J FOR INES’S JOB',6);
}
document.getElementById('start').onclick=startGame;
function controls(){
  if(input.take('enter')){if(!game.started||game.paused)startGame();}
  if(!game.started)return;
  if(input.take('escape')){
    if(game.shopOpen)game.toggleShop(false);else if(game.ui.briefOpen)game.ui.closeBrief();
    else {game.paused=!game.paused;document.getElementById('screen').classList.toggle('hidden',!game.paused);document.getElementById('start').innerHTML='RETURN TO SOLMARA <span>↵</span>';document.exitPointerLock?.();}
  }
  if(input.take('m'))game.mapLarge=!game.mapLarge;
  if(input.take('t')){setSeason(game.env,scene,game.env.season+1);game.save.season=game.env.season;saveGame(game.save);game.notify('CITY SEASON / '+SEASONS[game.env.season].name);}
  if(input.take('r')){game.radioOn=!game.radioOn;game.notify(game.radioOn?'SOL WAVE 98.4 / NIKO IS BACK':'RADIO OFF');}
  if(input.take('v')){const list=game.save.weapons,index=list.indexOf(game.combat.weapon);game.combat.weapon=list[(index+1)%list.length];}
  for(let i=0;i<3;i++)if(input.take(String(i+1))){if(game.save.weapons.includes(i))game.combat.weapon=i;else game.notify(WEAPONS[i].name+' / BUY AT ESTRELLA OR CUSTOMS');}
  if(input.take('j'))game.acceptJob();
  if(input.take('b')){
    if(game.police.heat>0&&!game.police.seen&&game.save.cash>=450){game.save.cash-=450;game.police.heat=Math.max(0,game.police.heat-1);saveGame(game.save);game.notify('INES BURNED A LEAD / ONE STAR CLEARED');}
    else game.notify('BRIBE / NEED $450 AND NO VISUAL CONTACT');
  }
  if(input.take('q')){
    const cover=[...game.traffic,...game.garage,...game.police.units].some(c=>distance(c,game.player)<5);
    game.inCover=!game.car&&cover&&!game.inCover;game.notify(game.inCover?'IN COVER / REDUCED INCOMING FIRE':'COVER / STAND WITHIN 5 M OF A CAR');
  }
  if(input.take('e'))interact();
}
function interact(){
  if(game.shopOpen){game.toggleShop(false);return;}
  if(game.flying){
    const floor=surfaceHeight(city,game.player.x,game.player.z);
    if(game.player.y-floor>3||Math.abs(game.speed)>5){game.notify('LAND GENTLY BEFORE EXITING');return;}
    game.flying=null;game.avatar.mesh.visible=true;game.player.x+=3;game.player.y=floor;game.notify('ROTOR DOWN / ON FOOT');return;
  }
  if(game.car){
    const c=game.car;game.player.x=c.x+Math.cos(c.heading)*3;game.player.z=c.z-Math.sin(c.heading)*3;c.speed=0;c.vx=0;c.vz=0;game.car=null;game.avatar.mesh.visible=true;game.inCover=false;return;
  }
  const service=SERVICES.find(s=>s.kind!=='heli'&&distance(s,game.player)<9);
  if(service){
    if(service.kind==='safe'){
      if(game.police.seen){game.notify('SAFEHOUSE / BREAK POLICE SIGHT FIRST');return;}
      game.health=100;game.save.season=game.env.season;game.save.hour=game.env.hour;saveGame(game.save);clearPolice(game);game.notify('PEARL HOUSE / GAME SAVED / CREW RECOVERED');
    }else game.toggleShop(true);return;
  }
  const heli=game.parkedHeli;
  if(distance(game.player,heli)<7&&Math.abs(game.player.y-heli.y)<4){game.flying=heli;game.avatar.mesh.visible=false;game.notify('MARA’S KITE / H LIFT · W FORWARD · CTRL DESCEND');return;}
  const cars=[...game.garage,...game.traffic,...game.police.units].filter(c=>distance(c,game.player)<7&&c.health>0);
  cars.sort((a,b)=>distance(a,game.player)-distance(b,game.player));
  if(cars[0]){game.car=cars[0];game.car.stolen=true;game.car.vx=0;game.car.vz=0;game.police.units=game.police.units.filter(c=>c!==game.car);if(!game.garage.includes(game.car)&&!game.traffic.includes(game.car))game.traffic.push(game.car);game.avatar.mesh.visible=false;game.inCover=false;if(!game.garage.includes(game.car)){game.commitCrime('vehicle theft',1);game.notify('VEHICLE TAKEN / '+game.car.kind);}else game.notify(game.car.kind+' / READY TO ROLL');return;}
  game.notify('NO RIDE NEARBY / FOLLOW THE MAP TO A SERVICE');
}
let recovery=0;
function simulation(dt){
  game.time+=dt;game.shake=Math.max(0,game.shake-dt);game.slow=Math.max(0,game.slow-dt);game.hitmark=Math.max(0,game.hitmark-dt);game.muzzle=Math.max(0,game.muzzle-dt);
  if((game.shopOpen||game.ui.briefOpen)&&game.health>0&&(game.car?.health??1)>0&&(game.flying?.health??1)>0){updateEnvironment(game,dt);return;}
  if(game.inCover&&![...game.traffic,...game.garage,...game.police.units].some(c=>distance(c,game.player)<6))game.inCover=false;
  const steer=(input.held('a')||input.held('arrowleft')?1:0)-(input.held('d')||input.held('arrowright')?1:0);
  const drive={forward:input.held('w')||input.held('arrowup'),back:input.held('s')||input.held('arrowdown'),steer,boost:input.held('shift'),brake:input.held(' '),up:input.held('h')||input.held(' '),down:input.held('control')};
  if(!game.shopOpen&&!game.ui.briefOpen&&game.health>0){
    if(game.car){driveCar(game.car,dt,drive,game);Object.assign(game.player,{x:game.car.x,z:game.car.z,y:game.car.y,heading:game.car.heading});game.speed=game.car.speed;}
    else if(game.flying){flyHelicopter(game.flying,dt,drive,game);Object.assign(game.player,{x:game.flying.x,z:game.flying.z,y:game.flying.y,heading:game.flying.heading});game.speed=game.flying.speed;}
    else {game.player.heading+=steer*dt*2;const speed=(drive.forward?1:0)-(drive.back?1:0),pace=game.inCover?2:input.held('shift')?9:5.6;
      moveOnStreets(city,game.player,Math.sin(game.player.heading)*speed*pace*dt,Math.cos(game.player.heading)*speed*pace*dt,.5);
      const floor=surfaceHeight(city,game.player.x,game.player.z);if(game.player.y>floor)game.player.y=Math.max(floor,game.player.y-dt*18);
      Object.assign(game.avatar,game.player);posePerson(game.avatar,game.time,speed!==0);game.speed=0;
    }
    if(mouseDown||input.held('k'))fireWeapon(game);
  }
  if(!game.flying)game.parkedHeli.rotor.rotation.y+=dt*1.2;
  updateTraffic(game,dt);updatePolice(game,dt);updateCombat(game,dt);updateEnvironment(game,dt);
  if(!game.shopOpen&&!game.ui.briefOpen){updateMission(game,dt);updateActivities(game,dt);}
  if(game.time%12<dt){game.save.season=game.env.season;game.save.hour=game.env.hour;saveGame(game.save);}
  if(game.health<=0||game.car?.health<=0||game.flying?.health<=0){
    recovery+=dt;if(recovery<dt*2){failMission(game,'The crew needs another chance');game.notify('BUSTED / CREW RECOVERY IN 3 SECONDS',4);}
    if(recovery>3){clearPolice(game);game.health=100;if(game.car)game.car.health=100;if(game.flying){game.flying.health=140;game.flying.x=-256;game.flying.z=192;game.flying.y=0;}game.car=null;game.flying=null;game.avatar.mesh.visible=true;Object.assign(game.player,{x:0,z:-64,y:0});game.save.cash=Math.max(0,game.save.cash-200);saveGame(game.save);game.ui.closeBrief();recovery=0;}
  }
  game.djTime-=dt;
  if(game.djTime<=0){game.djTime=20;game.dj=game.police.heat>0?`Niko: ${Math.ceil(game.police.heat)} stars over ${district(game.player)}. ${game.police.seen?'They see you. Find cover.':'They lost the trail. Stay quiet.'}`:`Niko: ${SEASONS[game.env.season].name.toLowerCase()} on the coast. ${game.save.done}/12 debts cleared. Pearl Street keeps its own score.`;}
  tickAudio(dt,game.speed,game.police.heat>0,game.radioOn);
}
function cameraAndMarkers(dt){
  const p=game.player,target=missionTarget(game);
  for(const person of game.people)person.mesh.visible=distance(person,p)<(game.flying?100:125);
  for(const car of game.traffic)car.mesh.visible=car===game.car||distance(car,p)<(game.flying?210:185);
  if(target){beacon.visible=true;beacon.position.set(target.x,(target.y||0)+4.5,target.z);targetRing.visible=true;targetRing.position.set(target.x,(target.y||0)+.15,target.z);}else {beacon.visible=false;targetRing.visible=false;}
  const desired=new T.Vector3(),look=new T.Vector3();
  if(game.shot==='autumn'){
    desired.set(p.x-45,p.y+31,p.z-55);look.set(p.x+30,p.y-45,p.z+55);
  }else if(game.shot==='spring'){
    desired.set(p.x+9,4.8,p.z-16);look.set(p.x+2,3.8,p.z+8);
  }else if(game.shot){
    desired.set(p.x+10,6.3,p.z-17);look.set(p.x,2.1,p.z+8);
  }else if(!game.started){desired.set(20,11,-91);look.set(0,3,-38);}
  else {
    const behind=game.flying?27:game.car?13:7,up=game.flying?12:game.car?5.3:3.6;
    desired.set(p.x-Math.sin(p.heading)*behind+(game.car?0:Math.cos(p.heading)*1.3),p.y+up,p.z-Math.cos(p.heading)*behind-(game.car?0:Math.sin(p.heading)*1.3));
    look.set(p.x+Math.sin(p.heading)*5,p.y+(game.flying?0:1.5),p.z+Math.cos(p.heading)*5);
    if(!lineOfSight(city,{x:p.x,z:p.z,y:p.y+2},{x:desired.x,z:desired.z,y:desired.y}))desired.lerp(new T.Vector3(p.x,p.y+3,p.z),.7);
  }
  if(game.cameraSnap){camera.position.copy(desired);game.cameraSnap=false;}else camera.position.lerp(desired,1-Math.exp(-dt*7));
  if(game.shake>0){camera.position.x+=(Math.random()-.5)*game.shake;camera.position.y+=(Math.random()-.5)*game.shake;}
  camera.lookAt(look);camera.fov=game.flying?62:57+Math.min(7,Math.abs(game.speed)*.08);camera.updateProjectionMatrix();
}
function stageSeasonShot(name){
  game.started=true;document.getElementById('screen').classList.add('hidden');
  const seasons={spring:0,summer:1,autumn:2,winter:3};setSeason(game.env,scene,seasons[name]??0);
  game.save.weapons=[0,1,2];game.save.ammo=[62,18,32];game.save.done=name==='spring'?2:name==='autumn'?6:11;
  game.mission.index=game.save.done;game.mission.status='active';game.mission.timer=147;game.mission.started=true;game.mission.phase=0;game.mission.progress=0;
  game.save.packages=[0,2,4,6];game.save.races=[61.2,null,null];game.save.jumps=[1];game.env.hour=name==='winter'?22.1:name==='autumn'?15.6:17.3;
  if(name==='spring'){
    Object.assign(game.player,{x:0,z:-66,y:0,heading:.1});game.combat.weapon=1;
    game.dj='Niko: Light showers on Pearl Street. Customs is open, Ines has work, and the blossoms are falling.';
    game.mission.index=2;game.mission.status='briefing';
    // Real inventory and the open storefront are readable without hiding the street.
    game.traffic.slice(0,4).forEach((c,i)=>{Object.assign(c,{x:i%2?4:-4,z:-30+i*14,axis:1,dir:i%2?1:-1});c.heading=c.dir>0?0:Math.PI;syncCar(c);});
  }else if(name==='autumn'){
    game.flying=game.parkedHeli;Object.assign(game.flying,{x:-140,z:-120,y:130,heading:.7,speed:23});Object.assign(game.player,{x:-140,z:-120,y:130,heading:.7});game.flying.mesh.position.set(-140,130,-120);game.flying.mesh.rotation.y=.7;game.mission.index=6;game.mission.phase=1;game.mission.progress=3;
    game.avatar.mesh.visible=false;game.dj='Mara on SOL WAVE: Luz is on the Glass Quarter roof. Keep the Kite steady and watch the crosswind.';
  }else {
    const z=name==='winter'?45:-16;game.car=game.garage[0];Object.assign(game.car,{x:0,z,y:0,heading:0,speed:38,nitro:.63});Object.assign(game.player,{x:0,z,y:0,heading:0});game.avatar.mesh.visible=false;game.car.flame.visible=true;game.combat.weapon=2;syncCar(game.car);
    game.mission.index=11;game.mission.phase=1;game.mission.timer=96;game.police.heat=5;game.police.mode='VISUAL CONTACT';game.police.seen=true;game.police.lastSeen={x:0,z};game.police.dispatch=100;game.police.blockTimer=100;
    for(const [x,offset] of [[-4,-8],[5,-13],[-4,20]]){const c=createCar(scene,x,z+offset,0x2c5f78,'POLICE');c.heading=0;c.speed=24;c.route=[];c.repath=1;syncCar(c);game.police.units.push(c);}
    game.police.heli=createHelicopter(scene,-5,z+34,0x345667);Object.assign(game.police.heli,{x:-5,z:z+34,y:11});game.police.heli.mesh.position.set(-5,11,z+34);
    game.dj=name==='summer'?'Niko: FIVE STARS! Air unit over Pearl Street. The reserve is in your trunk. Bring the crew home.':'Niko after dark: Snow, slick roads and a five-star lockdown. Pearl House is still waiting for you.';
    game.traffic.slice(0,4).forEach((c,i)=>{Object.assign(c,{x:i%2?4:-4,z:z+24+i*18,axis:1,dir:1});c.heading=0;syncCar(c);});
  }
  Object.assign(game.avatar,game.player);posePerson(game.avatar,0);game.avatar.gun.visible=name==='spring';game.avatar.longBarrel.visible=name==='spring';game.ui.draw(0);game.cameraSnap=true;
}
if(shot)stageSeasonShot(shot);
let last=performance.now(),frames=0;
function frame(now){
  requestAnimationFrame(frame);const realDt=Math.min(.05,(now-last)/1000);last=now;controls();
  const dt=game.slow>0?realDt*.5:realDt;
  if(game.shot){
    // Capture scenes use the same city, actors, inventory, weather and HUD. Only
    // their initial situation and camera are staged; normal play has no script.
    game.time+=realDt;updateEnvironment(game,realDt);game.flying?.rotor.rotation.set(0,game.time*30,0);if(game.police.heli)game.police.heli.rotor.rotation.y=game.time*32;
    game.police.units.forEach(c=>syncCar(c,game.time));game.speed=game.car?.speed||game.flying?.speed||0;
  }else if(game.started&&!game.paused)simulation(dt);
  cameraAndMarkers(realDt||.016);game.ui.draw(realDt);renderer.render(scene,camera);
  presses.clear();frames++;if(frames>2)window.__shotReady=true;
}
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
document.addEventListener('visibilitychange',()=>{keys.clear();mouseDown=false;if(document.hidden&&game.started&&!game.shot){game.paused=true;document.getElementById('screen').classList.remove('hidden');}});
window.solmara={game,startMission,updateMission,missionTarget,failMission,fireWeapon,setSeason,clearPolice,lineOfSight,reportCrime,startGame,simulation,interact};
requestAnimationFrame(frame);
