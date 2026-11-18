import * as T from '../vendor/three.module.min.js';
import { createCar, createHelicopter, syncCar } from './actors.js';
import { clamp, distance, headingTo, wrap } from './config.js';
import { lineOfSight, moveOnStreets } from './city.js';

export function createPolice() {
  return {heat:0,units:[],heli:null,lastSeen:{x:0,z:0},seen:false,lost:0,dispatch:0,roadblocks:[],blockTimer:0,mode:'NO ACTIVE ALERT',crimeCooldown:0};
}
export function reportCrime(game,kind,amount=1) {
  const p=game.police;
  if(p.crimeCooldown>0&&amount<1&&kind!=='gunfire')return;
  p.crimeCooldown=.8;p.heat=clamp(p.heat+amount,0,5);p.lastSeen={x:game.player.x,z:game.player.z};p.lost=0;
  game.radioMessage(`Niko: Reports of ${kind} in ${game.district()}. A ${game.car?'Mariner':'suspect'} is on the move.`,9);
}
function roadNode(p) {return {x:clamp(Math.round(p.x/64)*64,-256,256),z:clamp(Math.round(p.z/64)*64,-256,256)};}
export function planRoadRoute(start,end) {
  const from=roadNode(start),goal=roadNode(end),key=n=>n.x+','+n.z;
  const queue=[from],prior=new Map([[key(from),null]]),nodes=new Map([[key(from),from]]);
  for(let i=0;i<queue.length;i++){
    const at=queue[i];if(key(at)===key(goal))break;
    const choices=[[64,0],[-64,0],[0,64],[0,-64]].map(([x,z])=>({x:at.x+x,z:at.z+z}));
    choices.sort((a,b)=>distance(a,goal)-distance(b,goal));
    for(const n of choices){const k=key(n);if(Math.abs(n.x)>256||Math.abs(n.z)>256||prior.has(k))continue;prior.set(k,key(at));nodes.set(k,n);queue.push(n);}
  }
  const path=[];let current=key(goal);
  while(current&&prior.has(current)){path.push(nodes.get(current));current=prior.get(current);}
  return path.reverse();
}
function createRoadblock(game) {
  const p=game.police,dir=game.player.heading||0;
  const raw={x:game.player.x+Math.sin(dir)*100,z:game.player.z+Math.cos(dir)*100},node=roadNode(raw);
  if(p.roadblocks.some(b=>distance(b,node)<55))return;
  const block={...node,age:0,cars:[],props:[]};
  const alongZ=Math.abs(Math.cos(dir))>.5;
  for(const offset of [-5,5]){
    const c=createCar(game.scene,node.x+(alongZ?offset:0),node.z+(alongZ?0:offset),0x2f5263,'POLICE');
    c.heading=alongZ?Math.PI/2:0;c.speed=0;c.health=140;c.block=true;syncCar(c,game.time);block.cars.push(c);p.units.push(c);
  }
  for(let i=-2;i<=2;i++){
    const cone=new T.Mesh(new T.ConeGeometry(.38,.9,6),new T.MeshStandardMaterial({color:0xff9c4e}));
    cone.position.set(node.x+(alongZ?i*3:6),.45,node.z+(alongZ?6:i*3));game.scene.add(cone);block.props.push(cone);
  }
  p.roadblocks.push(block);game.notify('DISPATCH / ROADBLOCK AT THE NEXT INTERSECTION');game.radioMessage('Niko: Units are sealing the avenues. Find a side street.',8);
}
export function clearPolice(game) {
  const p=game.police;
  for(const c of p.units)game.scene.remove(c.mesh);
  for(const b of p.roadblocks)for(const o of b.props)game.scene.remove(o);
  if(p.heli)game.scene.remove(p.heli.mesh);
  Object.assign(p,createPolice());
}
export function updatePolice(game,dt) {
  const p=game.police;p.crimeCooldown=Math.max(0,p.crimeCooldown-dt);p.dispatch-=dt;p.blockTimer-=dt;
  if(p.heat<.05){if(p.units.length)clearPolice(game);p.mode='NO ACTIVE ALERT';return;}
  const stars=Math.ceil(p.heat),range=game.env.weather==='FOG'?40:game.env.weather==='THUNDERSTORM'?65:105;
  if(p.dispatch<=0&&p.units.filter(c=>!c.block).length<Math.min(6,stars+1)){
    p.dispatch=2;
    const angles=[0,Math.PI/2,Math.PI,-Math.PI/2],a=angles[p.units.length%4];
    const n=roadNode({x:p.lastSeen.x+Math.sin(a)*135,z:p.lastSeen.z+Math.cos(a)*135});
    const c=createCar(game.scene,n.x+3,n.z,0x2e5366,'POLICE');c.heading=headingTo(c,p.lastSeen);c.route=[];c.repath=0;p.units.push(c);
  }
  let seen=false;
  for(const c of p.units){
    if(c.health<=0){c.paint.color.setHex(0x383d3e);c.mesh.rotation.z=.12;continue;}
    const d=distance(c,game.player),bearing=headingTo(c,game.player);
    const cone=Math.abs(wrap(bearing-c.heading))<1.3||d<22;
    const visible=d<range&&cone&&lineOfSight(game.city,{...c,y:1.7},{...game.player,y:game.player.y+1});
    if(visible)seen=true;
    if(c.block){syncCar(c,game.time);if(visible&&d<30)game.damage(dt*(game.inCover?1:4));continue;}
    c.repath-=dt;
    if(c.repath<=0){c.repath=1.5;c.route=planRoadRoute(c,p.lastSeen);if(c.route.length>1&&distance(c,c.route[0])<14)c.route.shift();}
    while(c.route.length>1&&distance(c,c.route[0])<10)c.route.shift();
    let target=c.route[0]||p.lastSeen;
    if(visible&&lineOfSight(game.city,c,game.player)&&d<62)target=game.player;
    const desired=headingTo(c,target),turn=clamp(wrap(desired-c.heading),-dt*2.7,dt*2.7);c.heading+=turn;c.turn=turn/dt;
    const aimSpeed=d<7?4:visible?24+stars*2.3:18;
    c.speed+=(aimSpeed-c.speed)*dt*1.7;
    const hit=moveOnStreets(game.city,c,Math.sin(c.heading)*c.speed*dt,Math.cos(c.heading)*c.speed*dt,1.4);
    if(hit){c.speed*=.65;c.repath=0;c.heading+=dt*2;}
    if(visible&&d<23&&!game.flying)game.damage(dt*(game.car?1.8:game.inCover?1.6:7));
    if(d<4&&game.car){game.car.health-=dt*7;game.car.speed*=Math.exp(-dt*.6);}
    syncCar(c,game.time);
  }
  if(stars>=3&&!p.heli){p.heli=createHelicopter(game.scene,p.lastSeen.x-75,p.lastSeen.z+45,0x345667);p.heli.y=48;}
  if(p.heli&&stars<3&&p.lost>8){game.scene.remove(p.heli.mesh);p.heli=null;}
  if(p.heli){
    const h=p.heli;h.rotor.rotation.y+=dt*34;h.tail.rotation.x+=dt*29;
    const focus=p.lastSeen,hunt={x:focus.x+Math.sin(game.time*.25)*27,z:focus.z+Math.cos(game.time*.25)*27};
    h.x+=(hunt.x-h.x)*dt*.55;h.z+=(hunt.z-h.z)*dt*.55;h.y=48+Math.sin(game.time*.6)*3;
    h.heading=headingTo(h,focus);h.mesh.position.set(h.x,h.y,h.z);h.mesh.rotation.y=h.heading;
    const visible=distance(h,game.player)<range*1.1&&lineOfSight(game.city,{x:h.x,z:h.z,y:h.y},{...game.player,y:game.player.y+1});
    if(visible)seen=true;h.cone.visible=visible;h.spot.intensity=visible?65:10;
  }
  p.seen=seen;
  if(seen){p.lastSeen={x:game.player.x,z:game.player.z};p.lost=0;p.mode='VISUAL CONTACT';}
  else {p.lost+=dt;p.mode=p.lost>4?'SEARCHING LAST POSITION':'BREAKING SIGHT';}
  if(p.lost>10){p.heat=Math.max(0,p.heat-dt*.16);p.mode='COOLING DOWN';}
  if(stars>=4&&p.blockTimer<=0&&Math.abs(game.speed)>10){p.blockTimer=23;createRoadblock(game);}
  for(let i=p.roadblocks.length-1;i>=0;i--){const b=p.roadblocks[i];b.age+=dt;if(b.age>48&&distance(b,game.player)>80){for(const o of b.props)game.scene.remove(o);for(const c of b.cars){if(!c.stolen)game.scene.remove(c.mesh);p.units=p.units.filter(u=>u!==c);}p.roadblocks.splice(i,1);}}
}
