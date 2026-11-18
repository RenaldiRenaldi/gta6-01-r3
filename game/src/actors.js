import * as T from '../vendor/three.module.min.js';
import { clamp, rng, wrap, WEAPONS, distance, headingTo } from './config.js';
import { moveOnStreets, lineOfSight, surfaceHeight } from './city.js';
import { gunSound, noise } from './audio.js';

const shared={box:new T.BoxGeometry(1,1,1),wheel:new T.CylinderGeometry(.43,.43,.28,10),sphere:new T.SphereGeometry(1,12,8)};
const materialCache=new Map();
const material=(color,extra={})=>{
  const key=color+JSON.stringify(extra);
  if(!materialCache.has(key))materialCache.set(key,new T.MeshStandardMaterial({color,roughness:.5,...extra}));
  return materialCache.get(key);
};
const basicCache=new Map();
function basic(color){if(!basicCache.has(color))basicCache.set(color,new T.MeshBasicMaterial({color}));return basicCache.get(color);}
const dark=material(0x172a32),glass=material(0x46747e,{metalness:.6,roughness:.16}),chrome=material(0xc4d9d4,{metalness:.8,roughness:.22});
function piece(parent,x,y,z,w,h,d,mat,geometry=shared.box){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;}
function blob(parent,w,d,y=.025){const m=piece(parent,0,y,0,w,.01,d,new T.MeshBasicMaterial({color:0x102028,transparent:true,opacity:.28}));return m;}

function batchRigidParts(group,exclude) {
  const batches=new Map();
  for(const part of [...group.children]){
    if(!part.isMesh||exclude.includes(part))continue;
    part.updateMatrix();const geometry=part.geometry.clone().applyMatrix4(part.matrix).toNonIndexed();
    if(!batches.has(part.material))batches.set(part.material,[]);batches.get(part.material).push({part,geometry});
  }
  for(const [mat,entries] of batches){
    if(entries.length<2){entries.forEach(e=>e.geometry.dispose());continue;}
    const geometry=new T.BufferGeometry();
    for(const name of ['position','normal','uv']){
      const arrays=entries.map(e=>e.geometry.attributes[name]);if(arrays.some(a=>!a))continue;
      const values=new Float32Array(arrays.reduce((n,a)=>n+a.array.length,0));let offset=0;
      for(const a of arrays){values.set(a.array,offset);offset+=a.array.length;}
      geometry.setAttribute(name,new T.BufferAttribute(values,arrays[0].itemSize));
    }
    for(const e of entries){group.remove(e.part);e.geometry.dispose();}
    group.add(new T.Mesh(geometry,mat));
  }
}

export function createCar(scene,x,z,color=0xcf6459,kind='Mariner GT') {
  const mesh=new T.Group(),paint=new T.MeshStandardMaterial({color,metalness:.48,roughness:.29});
  piece(mesh,0,.83,0,2.5,.75,4.9,paint);piece(mesh,0,.5,0,2.58,.22,4.5,dark);
  piece(mesh,0,1.47,-.15,2.08,.8,2.5,glass);piece(mesh,0,1.91,-.27,2.13,.13,2.3,paint);
  piece(mesh,0,1.43,-1.38,2.1,.13,.14,paint);piece(mesh,0,1.45,.99,2.14,.14,.16,paint);
  piece(mesh,0,.85,2.47,1.1,.32,.04,dark);piece(mesh,0,.51,2.5,2.35,.12,.12,chrome);
  piece(mesh,0,.55,-2.5,2.35,.1,.1,chrome);piece(mesh,0,.81,-2.5,.7,.22,.04,new T.MeshBasicMaterial({color:0xf8ecc5}));
  for(const x of [-1.23,1.23])for(const z of [-1.62,1.56]){const wheel=new T.Mesh(shared.wheel,dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.45,z);mesh.add(wheel);piece(mesh,x*1.01,.45,z,.05,.47,.47,chrome,shared.sphere);}
  const lights=[];
  for(const x of [-.86,.86]){
    piece(mesh,x,.95,2.48,.55,.19,.05,basic(0xffeac2));
    piece(mesh,x,.96,-2.48,.57,.21,.05,basic(0xff5b62));
    const beam=piece(mesh,x,.033,8,2.6,.015,12,new T.MeshBasicMaterial({color:0xffe6bd,transparent:true,opacity:.08,depthWrite:false}));lights.push(beam);
  }
  const flame=new T.Group();mesh.add(flame);
  for(const x of [-.7,.7]){const jet=new T.Mesh(new T.ConeGeometry(.19,1.6,8),basic(0x65ddff));jet.rotation.x=-Math.PI/2;jet.position.set(x,.53,-3.05);flame.add(jet);}
  flame.visible=false;
  const bars=[];
  if(kind==='POLICE'){
    piece(mesh,0,1.96,-.2,1.7,.16,.48,dark);
    for(const [x,c] of [[-.5,0x4ebcff],[.5,0xff5268]])bars.push(piece(mesh,x,2.1,-.2,.62,.23,.4,new T.MeshBasicMaterial({color:c})));
    piece(mesh,0,.86,0,2.53,.38,1.8,material(0xf2f1df));
  }
  blob(mesh,3.2,5.7);batchRigidParts(mesh,[flame,...bars,...lights]);mesh.position.set(x,0,z);scene.add(mesh);
  return {mesh,x,z,y:0,heading:0,speed:0,vx:0,vz:0,health:100,nitro:1,paint,kind,flame,bars,lights,air:0,vy:0,stolen:false};
}
export function syncCar(c,time=0) {
  c.mesh.position.set(c.x,c.y,c.z);c.mesh.rotation.set(c.air?-.13:0,c.heading,clamp(-c.turn*.02||0,-.06,.06));
  c.bars.forEach((m,i)=>m.visible=Math.floor(time*9)%2===i);
}
export function driveCar(c,dt,input,game) {
  const wet=game.env.wet,engine=game.save.upgrades.includes('engine'),max=engine?62:49;
  const before=c.speed;
  c.speed+=(input.forward?30:0)*dt-(input.back?43:0)*dt;
  c.speed*=Math.exp(-(input.brake?3.8:.46)*dt);
  if(input.boost&&c.nitro>.01&&input.forward){c.speed+=47*dt;c.nitro=Math.max(0,c.nitro-dt*.26);c.flame.visible=true;}
  else {c.nitro=Math.min(1,c.nitro+dt*(game.save.upgrades.includes('nos')?.11:.055));c.flame.visible=false;}
  c.speed=clamp(c.speed,-14,max+(c.flame.visible?22:0));
  c.turn=input.steer*(1.55-Math.min(.8,Math.abs(c.speed)*.011))*Math.sign(c.speed||1);
  c.heading+=c.turn*dt;
  const traction=dt*(wet> .6?2.8:9);
  c.vx+=(Math.sin(c.heading)*c.speed-c.vx)*Math.min(1,traction);
  c.vz+=(Math.cos(c.heading)*c.speed-c.vz)*Math.min(1,traction);
  if(c.air<=0&&moveOnStreets(game.city,c,c.vx*dt,c.vz*dt,1.45)){
    if(Math.abs(before)>7){c.health-=Math.abs(before)*.17;noise(.12,.3);game.shake=.15;}
    c.speed*=-.18;c.vx*=.2;c.vz*=.2;
  }else if(c.air>0){c.x=clamp(c.x+c.vx*dt,-310,310);c.z=clamp(c.z+c.vz*dt,-310,310);}
  for(let i=0;i<game.city.ramps.length;i++){
    const r=game.city.ramps[i];if(c.air<=0&&distance(c,r)<6&&Math.abs(c.speed)>24){c.air=1.3;c.vy=15;c.jump=i;game.slow=.75;game.notify('STUNT CAM / HOLD THE LANDING');}
  }
  if(c.air>0){c.air-=dt;c.vy-=dt*23;c.y=Math.max(0,c.y+c.vy*dt);if(c.y===0&&c.vy<0){c.air=0;game.activities.landJump(c.jump,c.speed);game.shake=.25;}}
  else c.y=0;
  for(const other of [...game.traffic,...game.police.units]){
    if(other===c)continue;
    if(distance(c,other)<3.3&&c.y<2){const impact=Math.abs(c.speed-other.speed);c.speed*=.65;other.speed*=.65;
      const a=headingTo(other,c);moveOnStreets(game.city,c,Math.sin(a)*dt*13,Math.cos(a)*dt*13,1.5);
      c.health-=impact*dt*.9;if(impact>14){game.commitCrime('collision',.2);game.shake=.1;}
    }
  }
  syncCar(c,game.time);
}
export function createHelicopter(scene,x,z,color=0xe6aa68) {
  const mesh=new T.Group(),paint=material(color,{metalness:.35,roughness:.32});
  piece(mesh,0,1.4,0,1.8,.95,2.8,paint,shared.sphere);piece(mesh,0,1.5,1.35,1.5,.8,1.4,glass,shared.sphere);
  piece(mesh,0,1.5,-3,.35,.4,4,paint);piece(mesh,0,2.1,-4.8,.25,1.5,.8,paint);
  const rotor=new T.Group();rotor.position.y=2.8;mesh.add(rotor);
  piece(rotor,0,0,0,.25,.07,10,dark);piece(rotor,0,0,0,10,.07,.25,dark);piece(mesh,0,2.4,0,.2,.8,.2,chrome);
  for(const x of [-1.4,1.4]){piece(mesh,x,.2,0,.16,.15,4,dark);piece(mesh,x*.6,.6,.9,.1,1,.1,chrome);piece(mesh,x*.6,.6,-.9,.1,1,.1,chrome);}
  const tail=new T.Group();tail.position.set(.3,2,-4.9);mesh.add(tail);piece(tail,0,0,0,.06,2.2,.15,dark);
  const spot=new T.SpotLight(0xe6f5df,55,120,.32,.7,1.1);spot.position.set(0,.8,1);spot.target.position.set(0,-30,8);mesh.add(spot,spot.target);
  const cone=new T.Mesh(new T.ConeGeometry(6,30,24,1,true),new T.MeshBasicMaterial({color:0xc8efff,transparent:true,opacity:.035,depthWrite:false,side:T.DoubleSide}));cone.position.y=-14;mesh.add(cone);
  blob(mesh,6,8);mesh.scale.setScalar(1.45);mesh.position.set(x,0,z);scene.add(mesh);
  return {mesh,rotor,tail,spot,cone,x,z,y:0,heading:0,speed:0,health:140};
}
export function flyHelicopter(h,dt,input,game) {
  h.heading+=input.steer*dt*1.1;h.speed+=(input.forward?24:input.back?-24:0)*dt;h.speed*=Math.exp(-dt*.6);h.speed=clamp(h.speed,-16,42);
  const height=surfaceHeight(game.city,h.x,h.z);
  if(input.up)h.y+=dt*15;if(input.down)h.y=Math.max(height,h.y-dt*12);h.y=clamp(h.y,0,145);
  if(h.y>2){const hit=moveOnStreets(game.city,h,Math.sin(h.heading)*h.speed*dt,Math.cos(h.heading)*h.speed*dt,2);if(hit){h.health-=dt*18;h.speed*=-.5;}}
  if(!input.up&&!input.down&&h.y<height){h.y=height;h.health-=dt*12;}
  h.mesh.position.set(h.x,h.y,h.z);h.mesh.rotation.set(h.speed*.004,h.heading,-input.steer*.08);h.rotor.rotation.y+=dt*34;h.tail.rotation.x+=dt*29;
}
export function createPerson(scene,x,z,shirt=0xead8b7,enemy=false) {
  const mesh=new T.Group(),cloth=material(shirt),skin=material(0xb27b59),pants=material(0x263d48);
  piece(mesh,0,1.2,0,.65,.8,.4,cloth);piece(mesh,0,1.92,0,.25,.3,.25,skin,shared.sphere);
  const limbs=[];
  for(const side of [-1,1]){limbs.push(piece(mesh,side*.19,.45,0,.23,.9,.25,pants));limbs.push(piece(mesh,side*.46,1.15,0,.19,.8,.2,skin));}
  const gun=new T.Group();gun.position.set(.46,1.1,.3);mesh.add(gun);
  piece(gun,0,0,.12,.12,.15,.47,dark);piece(gun,0,-.13,0,.1,.23,.13,dark);gun.visible=enemy;
  const longBarrel=piece(gun,0,0,.42,.09,.1,.53,chrome);longBarrel.visible=false;
  blob(mesh,.8,.7);scene.add(mesh);mesh.position.set(x,0,z);
  return {mesh,x,z,y:0,heading:0,health:100,enemy,gun,longBarrel,limbs,phase:Math.random()*6,cool:1.5,alive:true};
}
export function posePerson(p,time,moving=false) {
  p.mesh.position.set(p.x,p.y,p.z);p.mesh.rotation.y=p.heading;
  p.limbs.forEach((m,i)=>m.rotation.x=moving?Math.sin(time*9+(i%2)*Math.PI)*.45:0);
}
export function populateStreets(scene) {
  const traffic=[],people=[],random=rng(729);
  for(let i=0;i<48;i++){
    const axis=i%2,lane=(Math.floor(i/6)-4)*64+(i%4<2?4:-4);
    const c=createCar(scene,axis?lane:-290+random()*580,axis?-290+random()*580:lane,[0x48999c,0xedca8b,0xc9d3cf,0x904c60,0x567787,0xe6a08d][i%6],i%7===0?'Cora Taxi':'City sedan');
    c.axis=axis;c.dir=i%4<2?1:-1;c.speed=9+random()*6;c.heading=axis?(c.dir===1?0:Math.PI):(c.dir===1?Math.PI/2:-Math.PI/2);traffic.push(c);
  }
  for(let i=0;i<100;i++){
    const p=createPerson(scene,(i%9-4)*64+(i%2?12:-12),-290+random()*580,[0xe7ba88,0x428e91,0xd48188,0x9cafaf][i%4]);
    p.dir=i%2?1:-1;p.axis=i%3===0;people.push(p);
  }
  return {traffic,people};
}
export function updateTraffic(game,dt) {
  for(const c of game.traffic){
    if(c===game.car||c.stolen)continue;
    const cross=c.axis?c.z:c.x,atCross=Math.abs(cross-Math.round(cross/64)*64)<13;
    const red=atCross&&Math.floor(game.time/8)%2===c.axis;
    const blocked=game.traffic.some(o=>o!==c&&o.axis===c.axis&&distance(c,o)<7&&Math.cos(headingTo(c,o)-c.heading)>.7);
    c.speed+=(red||blocked?0:12-c.speed)*dt;
    const speed=red||blocked?0:c.speed;
    if(c.axis)c.z+=speed*c.dir*dt;else c.x+=speed*c.dir*dt;
    if(Math.abs(c.x)>300)c.x=-Math.sign(c.x)*297;if(Math.abs(c.z)>300)c.z=-Math.sign(c.z)*297;
    syncCar(c,game.time);
  }
  for(const p of game.people){
    const panic=game.police.heat>0&&distance(p,game.player)<35;
    if(p.axis)p.x+=(panic?4:1.1)*p.dir*dt;else p.z+=(panic?4:1.1)*p.dir*dt;
    if(Math.abs(p.x)>298||Math.abs(p.z)>298)p.dir*=-1;
    p.heading=p.axis?p.dir*Math.PI/2:p.dir>0?0:Math.PI;posePerson(p,game.time+p.phase,true);
    if(game.car&&distance(p,game.car)<2&&Math.abs(game.car.speed)>12){p.dir*=-1;game.commitCrime('reckless driving',.12);}
  }
}
export function createCombat(scene) {return {enemies:[],targets:[],tracers:[],cool:0,kills:0,shots:0,weapon:0,scene};}
export function spawnRivals(game,points) {
  for(const p of game.combat.enemies)game.scene.remove(p.mesh);
  game.combat.enemies=points.map(([x,z])=>createPerson(game.scene,x,z,0xac526d,true));
  game.combat.kills=0;
}
export function fireWeapon(game) {
  const c=game.combat,w=WEAPONS[c.weapon];if(game.car||game.flying||c.cool>0)return;
  if(game.save.ammo[c.weapon]<=0){game.notify('EMPTY / RESTOCK AT ESTRELLA');c.cool=.5;return;}
  game.save.ammo[c.weapon]--;c.cool=w.cooldown;c.shots++;gunSound(c.weapon);game.commitCrime('gunfire',.45);game.muzzle=.09;
  const a={...game.player,y:1.4};
  for(let i=0;i<w.pellets;i++){
    const angle=game.player.heading+(Math.random()-.5)*w.spread;
    let target=null,best=w.range;
    for(const e of [...c.enemies,...c.targets,...game.police.units]){
      if(e.health<=0)continue;
      const d=distance(a,e),error=Math.abs(wrap(headingTo(a,e)-angle));
      if(d<best&&error<Math.atan2(e.kind?1.5:.65,d)+.035&&lineOfSight(game.city,a,{...e,y:1.5})){target=e;best=d;}
    }
    if(target){target.health-=w.damage*(c.weapon===1?Math.max(.25,1-best/w.range):1);game.hitmark=.18;
      if(target.health<=0){if(target.enemy){c.kills++;target.alive=false;target.mesh.rotation.z=Math.PI/2;target.mesh.position.y=.3;}else{target.disabled=true;target.speed=0;game.commitCrime('vehicle disabled',.7);}}
    }
    const b={x:a.x+Math.sin(angle)*best,y:1.4,z:a.z+Math.cos(angle)*best};
    const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(a.x,a.y,a.z),new T.Vector3(b.x,b.y,b.z)]);
    const line=new T.Line(geo,new T.LineBasicMaterial({color:0xffe3a2,transparent:true,opacity:.9}));game.scene.add(line);c.tracers.push({line,ttl:.09});
  }
}
export function updateCombat(game,dt) {
  const c=game.combat;c.cool=Math.max(0,c.cool-dt);
  for(let i=c.tracers.length-1;i>=0;i--){const t=c.tracers[i];t.ttl-=dt;if(t.ttl<=0){game.scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();c.tracers.splice(i,1);}}
  for(const e of c.enemies){
    if(!e.alive)continue;e.cool-=dt;const dist=distance(e,game.player);e.heading=headingTo(e,game.player);
    const visible=dist<65&&lineOfSight(game.city,{...e,y:1.6},{...game.player,y:(game.player.y||0)+1.2});
    if(visible&&dist>17){moveOnStreets(game.city,e,Math.sin(e.heading)*dt*2.8,Math.cos(e.heading)*dt*2.8,.5);}
    if(visible&&dist<55&&e.cool<=0){e.cool=1.2+Math.random()*.8;game.damage(game.inCover?1.2:5);const end=new T.Vector3(game.player.x,1.2,game.player.z);const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(e.x,1.4,e.z),end]),new T.LineBasicMaterial({color:0xff7888}));game.scene.add(line);c.tracers.push({line,ttl:.1});}
    posePerson(e,game.time,visible&&dist>17);
  }
  game.avatar.gun.visible=!game.car&&!game.flying;game.avatar.longBarrel.visible=c.weapon>0;
  game.avatar.gun.scale.set(c.weapon===1?1.4:1,1,c.weapon===2?1.8:1);
}
