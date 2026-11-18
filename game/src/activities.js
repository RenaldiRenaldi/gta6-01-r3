import * as T from '../vendor/three.module.min.js';
import { distance } from './config.js';
import { saveGame } from './storage.js';

export const RACES=[
  {name:'PEARL CIRCUIT',start:[0,-128],limit:95,reward:1200,points:[[0,-64],[64,-64],[128,-64],[128,64],[0,64],[0,-128]]},
  {name:'LANTERN SPRINT',start:[192,0],limit:100,reward:1600,points:[[192,64],[192,192],[256,192],[256,256],[128,256],[64,256],[0,256]]},
  {name:'OLD CORAL RUN',start:[-128,-128],limit:100,reward:1800,points:[[-192,-128],[-192,0],[-128,0],[-128,128],[-64,128],[-64,-64],[-128,-128]]},
];
export function createActivities(game) {
  const packages=[],rings=[],raceSigns=[];
  const locations=[[-12,-108],[12,36],[-76,76],[140,12],[204,140],[-204,-76],[76,-204],[-140,204],[12,272],[268,-116],[-268,-140],[140,268],[-76,-236],[204,-204],[-236,76]];
  locations.forEach(([x,z],id)=>{
    const material=new T.MeshStandardMaterial({color:0xf4d28c,emissive:0xf8b35a,emissiveIntensity:.5});
    const mesh=new T.Mesh(new T.OctahedronGeometry(.75),material);mesh.position.set(x,1.2,z);mesh.visible=!game.save.packages.includes(id);game.scene.add(mesh);packages.push({x,z,id,mesh});
  });
  for(let i=0;i<8;i++){
    const ring=new T.Mesh(new T.TorusGeometry(5,.15,6,40),new T.MeshBasicMaterial({color:0x77f4d7,transparent:true,opacity:.9}));ring.position.y=3;ring.visible=false;game.scene.add(ring);rings.push(ring);
  }
  RACES.forEach(r=>{
    const marker=new T.Mesh(new T.TorusGeometry(3,.12,5,40),new T.MeshBasicMaterial({color:0xffca81}));marker.rotation.x=Math.PI/2;marker.position.set(r.start[0],.1,r.start[1]);game.scene.add(marker);raceSigns.push(marker);
  });
  return {packages,rings,raceSigns,race:null,index:0,checkpoint:0,time:0,remaining:0,
    landJump(id,speed){if(Math.abs(speed)<15)return;const first=!game.save.jumps.includes(id);if(first){game.save.jumps.push(id);game.save.cash+=600;saveGame(game.save);}game.notify(`STUNT LANDED / ${first?'+$600':'STYLE +100'} / ${game.save.jumps.length}/3 JUMPS`);},
    startRace(index){const r=RACES[index];this.index=index;this.race=r;this.checkpoint=0;this.time=0;this.remaining=r.limit;game.notify(r.name+' / FOLLOW THE TEAL GATES');},
  };
}
export function updateActivities(game,dt) {
  const a=game.activities;
  for(const p of a.packages){p.mesh.rotation.y+=dt*1.5;p.mesh.position.y=1.5+Math.sin(game.time*2+p.id)*.2;if(p.mesh.visible&&!game.flying&&distance(p,game.player)<3){game.save.packages.push(p.id);p.mesh.visible=false;game.save.cash+=250;saveGame(game.save);game.notify(`HIDDEN LEDGER / ${game.save.packages.length}/15 / +$250`);}}
  if(game.input.take('c')){
    if(a.race){a.race=null;game.notify('TIME TRIAL ABANDONED');}
    else {let index=RACES.findIndex(r=>distance(game.player,{x:r.start[0],z:r.start[1]})<16);if(index<0)game.notify('C / START A RACE AT AN AMBER MAP FLAG');else if(!game.car)game.notify('YOU NEED A CAR FOR THE GRID');else a.startRace(index);}
  }
  a.rings.forEach(r=>r.visible=false);
  if(a.race){
    const r=a.race;a.time+=dt;a.remaining-=dt;
    r.points.forEach(([x,z],i)=>{if(i>=a.checkpoint){const ring=a.rings[i];ring.visible=true;ring.position.set(x,3,z);ring.rotation.y=i%2?Math.PI/2:0;ring.material.opacity=i===a.checkpoint?1:.24;}});
    const t=r.points[a.checkpoint];
    if(game.car&&distance(game.player,{x:t[0],z:t[1]})<8){a.checkpoint++;game.notify('CHECKPOINT '+a.checkpoint+'/'+r.points.length);if(a.checkpoint===r.points.length){
      const previous=game.save.races[a.index];if(previous===null||a.time<previous)game.save.races[a.index]=Math.round(a.time*100)/100;
      game.save.cash+=r.reward;saveGame(game.save);game.notify(`RACE WON / ${a.time.toFixed(2)}s / +$${r.reward}`,6);a.race=null;
    }}
    if(a.race&&(a.remaining<=0||game.health<=0||game.car?.health<=0)){a.race=null;game.notify('TIME TRIAL FAILED / RETURN TO THE GRID');}
  }
}
