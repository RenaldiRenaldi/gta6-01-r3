import { distance, clamp } from './config.js';
import { createCar, spawnRivals, syncCar } from './actors.js';
import { lineOfSight } from './city.js';
import { saveGame } from './storage.js';
import { clearPolice } from './police.js';

// Every job includes an authored action and a failure condition. Travel only
// positions the action; it can never complete a story job on its own.
export const JOBS = [
  {title:'A Picture Worth Trouble',contact:'INES VEGA / THE FIXER',type:'tail',time:180,reward:850,
    brief:'Auction broker Salo is selling Pearl Street behind our backs. Follow his cream sedan. Stay 18–80 m away for 12 seconds, then press P to photograph the meeting. Get too close and he will spot you.',goal:[0,0]},
  {title:'Three Stops, No Questions',contact:'TOMAS RUIZ / THE WHEELMAN',type:'delivery',time:125,reward:1200,
    brief:'Those photos bought us a witness. Deliver three sealed drives while dispatch hunts your plate. Every drop needs a slow pass below 20 km/h. Lose the patrols after the last one.',goal:[64,0]},
  {title:'The Exchange Goes South',contact:'LUZ MORENO / THE SIGNAL',type:'combat',time:170,reward:1450,
    brief:'The Vela outfit brought guns to our exchange. Get to Old Coral, step out of the car, and neutralize all four rivals. Q braces behind a nearby vehicle. Keep yourself alive.',goal:[-128,0]},
  {title:'Redline Witness',contact:'TOMAS RUIZ / THE WHEELMAN',type:'intercept',time:145,reward:1500,
    brief:'A Vela courier has the witness list. Disable his van with three hard rams or your weapons before he completes two circuits. Collect the list, then break police sight.',goal:[0,128]},
  {title:'Hold Pearl Street',contact:'LUZ MORENO / THE SIGNAL',type:'defend',time:150,reward:1650,
    brief:'I need 25 seconds on the relay outside Pearl House. Defend the relay, stay within 24 m, and stop Vela from overrunning it. The upload stalls if you leave. Six attackers are inbound.',goal:[0,-64]},
  {title:'A City With Blind Spots',contact:'INES VEGA / THE FIXER',type:'escape',time:130,reward:1600,
    brief:'Dispatch has your last position. Draw a three-star response, break their sight behind the blocks, and keep out of view for 14 seconds. Fog, alleys, and covered roofs are your friends.',goal:[-64,-64]},
  {title:'Borrowed Wings',contact:'MARA SOL / THE PILOT',type:'extract',time:220,reward:2200,
    brief:'Take the orange helicopter from Air Solmara. H lifts, Ctrl lowers. Land gently on the marked Glass Quarter roof and hold for six seconds to extract Luz. Then return her to the airport pad.',goal:[-256,192]},
  {title:'The Auction Cipher',contact:'LUZ MORENO / THE SIGNAL',type:'hack',time:170,reward:1900,
    brief:'Their relay terminal is on Alta Vista. Hold F nearby for 12 seconds to copy the cipher. Releasing F pauses the copy. Rival fire and patrols will make standing still expensive.',goal:[64,-192]},
  {title:'Night Freight',contact:'TOMAS RUIZ / THE WHEELMAN',type:'convoy',time:165,reward:2100,
    brief:'The armored van carries the auction reserve. Disable it on the waterfront, collect its two cash cases on foot, then leave the police search area. Do not let it reach its fourth checkpoint.',goal:[192,128]},
  {title:'The Last Broadcast',contact:'LUZ MORENO / THE SIGNAL',type:'broadcast',time:160,reward:2300,
    brief:'Niko gave us the transmitter. Defend it for 35 seconds while I air the evidence. Remain within 28 m. Vela comes in two waves. If they hold the site too long, the signal dies.',goal:[0,64]},
  {title:'All Roads Lead Home',contact:'MARA SOL / THE PILOT',type:'run',time:105,reward:2400,
    brief:'Bring the crew through four city checkpoints before the port auction starts. You need a car and a running engine. Heavy pursuit is confirmed. Hit every checkpoint and keep the crew alive.',goal:[-64,64]},
  {title:'The Twelfth Debt',contact:'INES VEGA / THE WHOLE CREW',type:'heist',time:250,reward:6500,
    brief:'Two phases. Clear the harbor guards and hold F at the reserve vault for 15 seconds. Then steal the reserve, survive the five-star lockdown, and deliver it to Pearl House only after losing visual contact. This buys our neighborhood back.',goal:[128,256]},
];
export function createMissions(game) {
  return {index:game.save.done,status:game.save.done>=12?'complete':'briefing',phase:0,timer:0,progress:0,kills:0,alarm:0,van:null,routeIndex:0,stops:[],collected:0,casePoints:[],signal:100,failReason:'',started:false};
}
export function startMission(game) {
  const m=game.mission;if(m.index>=12)return;
  if(m.van)game.scene.remove(m.van.mesh);
  spawnRivals(game,[]);game.combat.targets=[];
  const j=JOBS[m.index];Object.assign(m,{status:'active',phase:0,timer:j.time,progress:0,kills:0,alarm:0,van:null,routeIndex:0,collected:0,casePoints:[],signal:100,started:false,failReason:''});
  clearPolice(game);game.health=Math.max(game.health,85);if(game.car)game.car.health=Math.max(85,game.car.health);
  if(['tail','intercept','convoy'].includes(j.type)) {
    const p=j.type==='tail'?[0,-16]:j.type==='convoy'?[192,64]:[0,64];
    m.van=createCar(game.scene,...p,j.type==='tail'?0xeee0b0:0x8a6676,j.type==='tail'?'Salo’s sedan':'Vela courier');
    m.van.health=j.type==='tail'?1000:j.type==='convoy'?260:180;m.van.rams=0;m.van.routeIndex=0;m.van.laps=0;
    m.van.route=j.type==='tail'?[[0,64],[64,64],[64,0],[0,0]]:j.type==='convoy'?[[192,192],[128,192],[128,256],[256,256]]:[[0,128],[128,128],[128,0],[0,0]];
    game.combat.targets=j.type==='tail'?[]:[m.van];
  }
  if(j.type==='delivery'){m.stops=[[64,0],[64,-128],[-64,-128]];game.commitCrime('stolen evidence',2);}
  if(j.type==='run'){m.stops=[[-64,64],[-128,192],[64,192],[0,-64]];game.commitCrime('crew getaway',4);}
  if(j.type==='escape')game.commitCrime('auction evidence theft',3);
  game.notify(j.contact.split(' / ')[0]+' / '+j.title);game.ui.closeBrief();
}
export function failMission(game,reason) {
  const m=game.mission;if(m.status!=='active')return;
  m.status='failed';m.failReason=reason;game.notify('JOB FAILED / '+reason+' / J TO RETRY',8);game.ui.showBrief(true);
}
function completeMission(game) {
  const m=game.mission,j=JOBS[m.index];game.save.cash+=j.reward;game.save.done=m.index+1;saveGame(game.save);
  spawnRivals(game,[]);game.combat.targets=[];if(m.van){game.scene.remove(m.van.mesh);m.van=null;}
  m.index++;m.status=m.index===12?'complete':'briefing';
  game.notify(m.index===12?'PEARL STREET IS OURS / THE CREW MADE IT HOME':`DEBT CLEARED / +$${j.reward} / J FOR NEXT JOB`,8);
  game.radioMessage(m.index===12?'Niko: The reserve is back where it belongs. Solmara, this one is for you.':'Niko: Someone just put another dent in the port auction. Pearl Street is listening.',10);
  if(m.index===12)clearPolice(game);
}
function beginAmbush(game,count,goal) {
  const points=[];
  for(let i=0;i<count;i++)points.push([goal[0]+(i%2?7:-7),goal[1]+(Math.floor(i/2)-1)*13]);
  spawnRivals(game,points);game.commitCrime('rival crew exchange',1);game.mission.started=true;
}
export function missionTarget(game) {
  const m=game.mission,j=JOBS[m.index];if(!j)return null;
  if(m.status!=='active')return {x:j.goal[0],z:j.goal[1],y:0};
  if(m.van&&m.phase===0)return {x:m.van.x,z:m.van.z,y:1};
  if((j.type==='delivery'||j.type==='run')&&m.phase===0){const t=m.stops[Math.min(m.routeIndex,m.stops.length-1)];return {x:t[0],z:t[1],y:0};}
  if(j.type==='extract')return m.phase===0?{...game.city.pads[0]}:m.phase===1?{...game.city.pads[1]}:{...game.city.pads[0]};
  if(j.type==='heist'&&m.phase===1)return {x:0,z:-64,y:0};
  if(m.casePoints.length&&m.collected<m.casePoints.length)return m.casePoints[m.collected];
  return {x:j.goal[0],z:j.goal[1],y:0};
}
export function missionObjective(game) {
  const m=game.mission,j=JOBS[m.index];if(!j)return 'Pearl Street belongs to its people. Free roam unlocked.';
  if(m.status==='briefing')return 'J · Read '+j.contact.split(' / ')[0]+'’s briefing';
  if(m.status==='failed')return m.failReason+' · J to retry';
  const labels={
    tail:`Tail Salo · ${Math.floor(m.progress)}/12 s · ${Math.round(m.alarm)}% suspicion${m.progress>=12?' · P photograph':''}`,
    delivery:m.phase===0?`Drop ${m.routeIndex+1}/3 · Slow below 20 km/h at the marker`:'All drives delivered · Lose the wanted level',
    combat:`Exchange ambush · ${game.combat.kills}/4 rivals neutralized · Q cover`,
    intercept:m.phase===0?'Disable the courier · Ram hard or fire on foot':m.phase===1?'On foot · Collect the witness list':'Witness secured · Break sight for 8 s',
    defend:`Defend the relay · ${Math.floor(m.progress)}/25 s · Signal ${Math.ceil(m.signal)}%`,
    escape:`Break line of sight · ${Math.floor(m.progress)}/14 s unseen`,
    extract:m.phase===0?'E · Board the orange helicopter at Air Solmara':m.phase===1?`Land on the marked roof · Extraction ${Math.floor(m.progress)}/6 s`:'Luz aboard · Return and land at Air Solmara',
    hack:`Hold F at the terminal · Cipher ${Math.floor(m.progress/12*100)}%`,
    convoy:m.phase===0?'Disable the reserve van before its 4th checkpoint':m.phase===1?`Collect cash cases on foot · ${m.collected}/2`:'Cash secured · Evade sight for 10 s',
    broadcast:`Defend the transmitter · ${Math.floor(m.progress)}/35 s · Signal ${Math.ceil(m.signal)}%`,
    run:`Crew run · Checkpoint ${Math.min(4,m.routeIndex+1)}/4 · Keep the car alive`,
    heist:m.phase===0?`PHASE 1 · ${game.combat.kills}/6 guards · Hold F to crack vault ${Math.floor(m.progress/15*100)}%`:'PHASE 2 · Escape the lockdown · Return to Pearl House unseen',
  };
  return labels[j.type];
}
export function updateMission(game,dt) {
  const m=game.mission;if(m.status!=='active')return;
  const j=JOBS[m.index],p=game.player,goal={x:j.goal[0],z:j.goal[1]},d=distance(p,goal);
  m.timer-=dt;if(m.timer<=0){failMission(game,'Time ran out');return;}
  if(game.health<=0||game.car?.health<=0||game.flying?.health<=0){failMission(game,'The crew lost its ride or its driver');return;}
  if(m.van&&m.phase===0){
    const v=m.van,t=v.route[v.routeIndex],target={x:t[0],z:t[1]},a=Math.atan2(target.x-v.x,target.z-v.z);
    v.heading=a;v.speed=j.type==='tail'?9:12;
    if(v.health>0){v.x+=Math.sin(a)*v.speed*dt;v.z+=Math.cos(a)*v.speed*dt;}
    if(distance(v,target)<4){v.routeIndex++;if(v.routeIndex===v.route.length){v.routeIndex=0;v.laps++;}m.routeIndex++;}
    if(game.car&&distance(game.car,v)<4.3&&Math.abs(game.car.speed)>13&&(!v.ramCool||v.ramCool<=0)){v.rams++;v.health-=67;v.ramCool=1.2;game.car.speed*=.55;game.notify('COURIER HIT / '+Math.max(0,Math.ceil(v.health))+' HULL');game.commitCrime('courier interception',.7);}
    v.ramCool=Math.max(0,(v.ramCool||0)-dt);syncCar(v,game.time);
  }
  switch(j.type) {
    case 'tail': {
      const dist=distance(p,m.van),visible=lineOfSight(game.city,{...p,y:2},{...m.van,y:2});
      if(dist<16)m.alarm+=dt*15;else m.alarm=Math.max(0,m.alarm-dt*3);
      if(dist>110)m.alarm+=dt*9;
      if(dist>=18&&dist<80&&visible)m.progress=Math.min(12,m.progress+dt);
      if(m.alarm>=100)failMission(game,dist<18?'Salo spotted your tail':'You lost Salo');
      else if(m.progress>=12&&game.input.take('p')){
        if(dist<80&&visible){game.muzzle=.2;game.notify('PHOTO SECURED / SALO + THE PORT COMMISSIONER');completeMission(game);}else game.notify('NO CLEAR PHOTO / GET A LINE OF SIGHT');
      }break;
    }
    case 'delivery':case 'run': {
      if(m.phase===0){const t=m.stops[m.routeIndex];if(game.car&&distance(p,{x:t[0],z:t[1]})<10&&(j.type==='run'||Math.abs(game.speed)<5.55)){
        m.routeIndex++;game.notify(j.type==='run'?'CREW CHECKPOINT / KEEP MOVING':'DRIVE DELIVERED / '+m.routeIndex+' OF 3');
        if(m.routeIndex===m.stops.length){if(j.type==='run')completeMission(game);else {m.phase=1;game.notify('ALL DRIVES OUT / SHAKE THE POLICE');}}
      }}else if(game.police.heat<.1)completeMission(game);break;
    }
    case 'combat':if(!m.started&&d<48)beginAmbush(game,4,j.goal);if(m.started&&game.combat.kills>=4)completeMission(game);break;
    case 'intercept':case 'convoy': {
      if(m.phase===0){
        if(m.van.health<=0){m.phase=1;m.casePoints=j.type==='convoy'?[{x:m.van.x+4,z:m.van.z},{x:m.van.x-4,z:m.van.z+3}]:[{x:m.van.x+4,z:m.van.z}];game.commitCrime('reserve van robbery',3);game.notify('VEHICLE DISABLED / EXIT AND COLLECT THE CASES');}
        else if(j.type==='convoy'?m.routeIndex>=4:m.van.laps>=2)failMission(game,'The courier escaped');
      }else if(m.phase===1){const c=m.casePoints[m.collected];if(!game.car&&!game.flying&&distance(p,c)<4){m.collected++;game.notify('EVIDENCE SECURED');if(m.collected===m.casePoints.length){m.phase=2;m.progress=0;}}}
      else {if(!game.police.seen)m.progress+=dt;else m.progress=0;if(m.progress>=(j.type==='convoy'?10:8))completeMission(game);}break;
    }
    case 'defend':case 'broadcast': {
      const duration=j.type==='defend'?25:35;
      if(!m.started&&d<30)beginAmbush(game,6,j.goal);
      if(m.started){const attackers=game.combat.enemies.filter(e=>e.alive&&distance(e,goal)<20).length;
        if(d<(j.type==='defend'?24:28))m.progress+=dt;else m.signal-=dt*2.5;
        m.signal-=attackers*dt*.65;
        if(j.type==='broadcast'&&m.progress>17&&m.phase===0){m.phase=1;beginAmbush(game,4,j.goal);game.notify('SECOND WAVE / KEEP THE SIGNAL ALIVE');}
        if(m.signal<=0)failMission(game,'The transmitter was overrun');else if(m.progress>=duration)completeMission(game);
      }break;
    }
    case 'escape':if(!game.police.seen)m.progress+=dt;else m.progress=0;if(m.progress>=14)completeMission(game);break;
    case 'extract': {
      if(m.phase===0&&game.flying){m.phase=1;game.notify('MARA / ROOFTOP BEACON MARKED');}
      const pad=game.city.pads[m.phase===1?1:0];
      if(m.phase>0&&game.flying&&distance(p,pad)<7&&Math.abs(p.y-pad.y)<3&&Math.abs(game.speed)<5){m.progress+=dt;if(m.progress>=6){if(m.phase===1){m.phase=2;m.progress=0;game.commitCrime('rooftop extraction',2);game.notify('LUZ ABOARD / TAKE US HOME');}else completeMission(game);}}
      else if(m.phase>0)m.progress=Math.max(0,m.progress-dt*.5);break;
    }
    case 'hack':if(!m.started&&d<45)beginAmbush(game,3,j.goal);if(d<8&&!game.car&&game.input.held('f'))m.progress+=dt;if(m.progress>=12)completeMission(game);break;
    case 'heist': {
      if(m.phase===0){if(!m.started&&d<50)beginAmbush(game,6,j.goal);if(m.started&&game.combat.kills>=6&&d<9&&!game.car&&game.input.held('f'))m.progress+=dt;if(m.progress>=15){m.phase=1;game.save.cash+=500;game.commitCrime('port reserve heist',5);game.notify('VAULT OPEN / PHASE TWO / GET HOME UNSEEN',6);}}
      else if(distance(p,{x:0,z:-64})<12&&!game.police.seen&&game.police.lost>8)completeMission(game);break;
    }
  }
}
