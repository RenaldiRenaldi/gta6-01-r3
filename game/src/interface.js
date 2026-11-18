import { SEASONS, WEAPONS, SERVICES, distance, district } from './config.js';
import { JOBS, missionObjective, missionTarget } from './missions.js';
import { RACES } from './activities.js';

const $=id=>document.getElementById(id);
export function createInterface(game) {
  let notifyTimer=0,briefOpen=false;
  const goods=[
    ...WEAPONS.map((w,i)=>({id:'weapon'+i,name:w.name+' / '+w.rounds+' rounds',detail:[`Balanced sidearm · ${w.range} m`,`7 pellet spread · ${w.range} m`,`Precision · ${w.range} m`][i],price:w.price})),
    {id:'engine',name:'Mariner Stage II',detail:'Higher top speed / faster escapes',price:1000},
    {id:'armor',name:'Crew armor + repair',detail:'Restore health and reinforce your car',price:600},
    {id:'nos',name:'Long-burn NOS',detail:'Double nitro regeneration',price:650},
    {id:'repaint',name:'Fresh plates + paint',detail:'Clear an unseen vehicle alert',price:450},
  ];
  $('goods').innerHTML=goods.map(g=>`<button class="good" data-good="${g.id}"><span><b>${g.name}</b><small>${g.detail}</small></span><em>$${g.price}</em></button>`).join('');
  for(const button of document.querySelectorAll('[data-good]'))button.onclick=()=>game.purchase(goods.find(g=>g.id===button.dataset.good));
  $('closeshop').onclick=()=>game.toggleShop(false);
  $('accept').onclick=()=>game.acceptJob();
  const context=$('map').getContext('2d');
  function map() {
    const ctx=context,w=180,h=160,large=game.mapLarge,scale=large?.24:.55;
    const cx=large?0:game.player.x,cz=large?0:game.player.z;
    const pos=p=>[w/2+(p.x-cx)*scale,h/2+(p.z-cz)*scale];
    ctx.fillStyle='#153540';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2-cx*scale,h/2-cz*scale);ctx.scale(scale,scale);
    ctx.fillStyle='#29434a';ctx.fillRect(-318,-318,636,636);
    ctx.strokeStyle='#6d8587';ctx.lineWidth=17;ctx.beginPath();for(let i=-4;i<=4;i++){ctx.moveTo(-305,i*64);ctx.lineTo(305,i*64);ctx.moveTo(i*64,-305);ctx.lineTo(i*64,305);}ctx.stroke();
    ctx.fillStyle='#1d353f';for(const b of game.city.colliders)ctx.fillRect(b.x-b.w,b.z-b.d,b.w*2,b.d*2);ctx.restore();
    function dot(p,color,r=3){const [x,y]=pos(p);if(x<3||x>w-3||y<3||y>h-3)return;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();}
    if(game.police.heat>0){const [x,y]=pos(game.police.lastSeen);ctx.fillStyle='rgba(255,107,106,.12)';ctx.beginPath();ctx.arc(x,y,50*scale,0,7);ctx.fill();}
    for(const s of SERVICES)dot(s,s.kind==='heli'?'#90d7ff':'#e6c697',3);
    for(const r of RACES)dot({x:r.start[0],z:r.start[1]},'#f9c16f',3);
    for(const p of game.activities.packages)if(p.mesh.visible&&distance(game.player,p)<40)dot(p,'#ffe699',2);
    for(const c of game.police.units)dot(c,'#ff7a84',3);
    for(const e of game.combat.enemies)if(e.alive)dot(e,'#ef7a9e',2.6);
    const target=game.activities.race?game.activities.race.points[game.activities.checkpoint]:null;
    if(target)dot({x:target[0],z:target[1]},'#7bffe1',4);else {const t=missionTarget(game);if(t)dot(t,'#7bffe1',4);}
    const [px,py]=pos(game.player);ctx.save();ctx.translate(px,py);ctx.rotate(-game.player.heading);ctx.fillStyle='#fff1ce';ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(-4,-4);ctx.lineTo(4,-4);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle='#cfdfd7';ctx.font='9px monospace';ctx.fillText('N',w-12,12);
  }
  return {
    notify(text,seconds=4){$('toast').textContent=text;$('toast').classList.add('show');notifyTimer=seconds;},
    showBrief(failed=false){const m=game.mission,j=JOBS[m.index];if(!j)return;briefOpen=true;$('briefing').classList.remove('hidden');$('contact').textContent=j.contact;$('brieftitle').textContent=(failed?'RETRY / ':'')+j.title;$('briefcopy').textContent=(failed?m.failReason+'. ':'')+j.brief;$('accept').textContent=failed?'J · RETRY JOB':'J · TAKE THE JOB';},
    closeBrief(){briefOpen=false;$('briefing').classList.add('hidden');},
    get briefOpen(){return briefOpen;},
    draw(dt){
      if(notifyTimer>0){notifyTimer-=dt;if(notifyTimer<=0)$('toast').classList.remove('show');}
      const s=SEASONS[game.env.season],m=game.mission,j=JOBS[m.index],stars=Math.ceil(game.police.heat),race=game.activities.race;
      $('climate').innerHTML=`<b>${s.name} <span>·</span> ${game.env.weather}</b><small>${String(Math.floor(game.env.hour)).padStart(2,'0')}:${String(Math.floor(game.env.hour%1*60)).padStart(2,'0')} / ${game.flying?'AIRSPACE':'LEONORA COAST'}</small>`;
      $('vitals').innerHTML=`<b>$${game.save.cash.toLocaleString('en-US')}</b><small><span class="health">♥ ${Math.ceil(game.health)}</span> / ${game.car?'HULL '+Math.ceil(game.car.health):'CREW RESERVE'}</small>`;
      $('jobname').textContent=race?race.name:j?String(m.index+1).padStart(2,'0')+' / '+j.title:'12 / DEBTS CLEARED';
      $('objective').textContent=race?`CHECKPOINT ${game.activities.checkpoint+1}/${race.points.length} · ${game.activities.time.toFixed(1)}s elapsed`:missionObjective(game);
      $('jobprogress').innerHTML=(m.status==='active'||race)?`<span>${race?'TIME TRIAL':JOBS[m.index].contact.split(' / ')[0]}</span><b>${Math.ceil(race?game.activities.remaining:m.timer)}s</b>`:'<span>J · BRIEFING / RETRY</span><b>'+Math.min(12,game.save.done)+'/12</b>';
      $('stars').innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<stars?'lit':''}">★</span>`).join('');
      $('copstate').textContent=game.police.mode;
      $('copdetail').textContent=stars?(game.police.seen?'SIGHT CONFIRMED / BREAK CONTACT':`UNSEEN ${game.police.lost.toFixed(1)}s / HIDE TO COOL DOWN`):'SIGHTLINES MATTER / THE CITY REMEMBERS';
      $('pursuit').classList.toggle('hot',stars>0);
      $('dj').textContent=game.dj;$('station').innerHTML=game.radioOn?'SOL WAVE <i>98.4</i>':'RADIO <i>OFF</i>';
      $('district').textContent=district(game.player).split(' / ')[0];
      $('collectibles').textContent=`▧ ${game.save.packages.length}/15   ⚑ ${game.save.races.filter(r=>r!==null).length}/3   ↗ ${game.save.jumps.length}/3`;
      $('map').setAttribute('aria-label',`Minimap of ${district(game.player)}. Teal objective, amber races and services, red police.`);
      $('speed').innerHTML=game.car||game.flying?`${String(Math.round(Math.abs(game.speed)*3.6)).padStart(3,'0')}<small>${game.flying?'AIR KM/H':'KM/H'}</small>`:'<small>ON FOOT</small>';
      $('vehicle').textContent=game.flying?`MARA’S KITE / ALT ${Math.round(game.player.y)} M`:game.car?game.car.kind:'DANI CRUZ / PEARL CREW';
      $('nitro').style.width=(game.car?game.car.nitro*100:game.flying?game.flying.health/1.4:game.health)+'%';
      const gun=WEAPONS[game.combat.weapon];
      $('weapon').innerHTML=`<div class="weaponshape w${game.combat.weapon}"></div><b>${gun.name}</b> <span>${game.save.ammo[game.combat.weapon]} RDS</span><small>1 PISTOL · 2 SHOTGUN · 3 RIFLE${game.inCover?' / IN COVER':''}</small>`;
      $('crosshair').style.display=game.car||game.flying?'none':'block';$('crosshair').style.color=game.hitmark>0?'#ffbc82':'#f7e7c6';
      $('flash').style.opacity=game.muzzle>0?.16:0;
      $('prompt').textContent=game.contextPrompt();
      map();
    },
  };
}
