import * as T from '../vendor/three.module.min.js';
import { BLOCK, SERVICES, rng, clamp } from './config.js';

// A street-addressed island: dense mixed-use blocks, a separate working airport,
// the lantern marina, and a waterfront. Static architecture is instanced by material.
export function buildCity(scene) {
  const random=rng(), groups=new Map(), colliders=[],roofs=[], trees=[],lamps=[],signs=[],reflections=[];
  const standard=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.75,...extra});
  const mats={
    road:standard(0x34454c,{roughness:.32,metalness:.18}),curb:standard(0xd8cbb5),roof:standard(0xdfd8c5),
    dark:standard(0x25343c),white:standard(0xf8edcf),metal:standard(0x5e7275,{metalness:.5}),
    leaf:standard(0xf4b2c6),trunk:standard(0x7b5b46),pink:standard(0xe2a8a2),sand:standard(0xe5cf9f),
    yellow:new T.MeshBasicMaterial({color:0xe6c98a}),lamp:new T.MeshBasicMaterial({color:0xffdda6}),
    cyan:new T.MeshBasicMaterial({color:0x65f2df}),red:new T.MeshBasicMaterial({color:0xff6e88}),
  };
  const boxGeometry=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
  function box(x,y,z,w,h,d,material=mats.curb,ry=0) {
    if(!groups.has(material))groups.set(material,[]);
    groups.get(material).push({x,y,z,w,h,d,ry});
  }
  function mesh(geometry,material,x,y,z) {
    const m=new T.Mesh(geometry,material);m.position.set(x,y,z);scene.add(m);return m;
  }
  function ground(w,d,x,z,material,y=0) {
    const m=mesh(new T.PlaneGeometry(w,d),material,x,y,z);m.rotation.x=-Math.PI/2;return m;
  }
  const groundMat=standard(0x88aa80),waterMat=standard(0x287e91,{roughness:.24,metalness:.48});
  const water=ground(2300,2300,0,0,waterMat,-.8);
  const island=ground(638,638,0,0,groundMat,-.06);
  ground(26,640,329,0,mats.sand,-.02);ground(640,20,0,329,mats.sand,-.02);
  for(let i=-4;i<=4;i++) {
    const v=i*BLOCK;
    ground(612,20,0,v,mats.road,.015);ground(20,612,v,0,mats.road,.018);
    for(let p=-296;p<300;p+=12) {
      if(Math.abs(p%64)<13)continue;
      box(p,.04,v,5,.025,.17,mats.yellow);box(v,.041,p,.17,.025,5,mats.yellow);
    }
    for(let j=-4;j<=4;j++)for(let k=-2;k<=2;k++) {
      box(v+k*1.7,.045,j*64+12,1,.025,4,mats.white);
      box(v+12,.045,j*64+k*1.7,4,.025,1,mats.white);
    }
  }
  // Window atlases are generated locally. The repeated bays are architectural,
  // while lit rooms break the regularity and remain visible from the air at night.
  const buildingMats=[];
  const colors=['#7fa9ab','#e1b9a0','#879eaf','#da9d91','#619aaf','#b8c8b6'];
  for(let i=0;i<6;i++) {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
    const c=canvas.getContext('2d');c.fillStyle=colors[i];c.fillRect(0,0,128,256);
    for(let y=6;y<256;y+=20)for(let x=5;x<128;x+=16) {
      c.fillStyle=random()>.69?'#f5dc99':random()>.5?'#496975':'#678690';c.fillRect(x,y,9,12);
      c.fillStyle='rgba(18,41,49,.4)';c.fillRect(x,y+12,10,2);
    }
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    texture.magFilter=T.NearestFilter;
    buildingMats.push(standard(0xffffff,{map:texture,emissive:0x8e9c9d,emissiveMap:texture,emissiveIntensity:.24,roughness:.53,metalness:.1}));
  }
  function building(x,z,w,d,h,index) {
    box(x,h/2,z,w,h,d,buildingMats[index%6]);
    box(x,h+.3,z,w+1,.65,d+1,mats.roof);
    box(x,h+1,z-d/2+.25,w+1,1.7,.5,mats.roof);box(x,h+1,z+d/2-.25,w+1,1.7,.5,mats.roof);
    box(x-w/2+.25,h+1,z,.5,1.7,d,mats.roof);box(x+w/2-.25,h+1,z,.5,1.7,d,mats.roof);
    const count=h>35?3:1;
    for(let i=0;i<count;i++){
      const ax=x-w*.22+i*4;
      box(ax,h+1.2,z,2.8,1.7,3.2,mats.metal);box(ax,h+2.1,z,2.2,.12,2.4,mats.dark);
    }
    if(random()>.6){box(x+w*.28,h+4,z-d*.25,.15,7,.15,mats.metal);box(x+w*.28,h+6,z-d*.25,3,.12,.12,mats.metal);}
    colliders.push({x,z,w:w/2+.6,d:d/2+.6,h});roofs.push({x,z,y:h+1,w:w/2-1,d:d/2-1});
  }
  for(let bx=-4;bx<4;bx++)for(let bz=-4;bz<4;bz++) {
    if(bx===-4&&bz>=1)continue;
    const cx=bx*64+32,cz=bz*64+32;
    box(cx,.13,cz,43,.3,43,mats.curb);
    const downtown=bx>=0&&bx<=2&&bz>=0&&bz<=2;
    for(let i=0;i<4;i++) {
      const x=cx+(i%2?10.8:-10.8),z=cz+(i<2?-10.8:10.8);
      const h=downtown?30+random()*74:9+random()*24;
      building(x,z,17+random()*3,17+random()*3,h,bx+bz+i+20);
    }
  }
  // Retail occupies the sidewalk edge and has readable, illuminated local signs.
  function sign(text,x,y,z,width,color,rotation=0) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
    const c=canvas.getContext('2d');c.fillStyle='#102d37';c.fillRect(0,0,512,96);
    c.strokeStyle=color;c.lineWidth=5;c.strokeRect(3,3,506,90);c.fillStyle=color;
    c.font='bold '+(text.length>18?27:36)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,49,482);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    const material=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});
    const panel=mesh(new T.PlaneGeometry(width,width*96/512),material,x,y,z);panel.rotation.y=rotation;signs.push(panel);return panel;
  }
  for(const [text,x,z,color] of [
    ['PALMETTO CUSTOMS',17,-49,'#7affdf'],['PEARL HOUSE',-18,-49,'#ffd2a2'],
    ['ESTRELLA / ARMS',-17,15,'#ff8b9e'],['SOL WAVE 98.4',17,79,'#ffcd75'],
    ['NOODLES / OPEN LATE',-18,79,'#ff6d92'],['HOTEL AZUL',-18,143,'#7be0ff'],
    ['THE GLASS QUARTER',18,207,'#ffe0a6'],['LANTERN MARINA',15,272,'#6ff5e4'],
  ]) {
    box(x,2,z,11,4,9,x>0?mats.pink:mats.white);
    sign(text,x,4,z-4.56,12,color,Math.PI);
    box(x,3.1,z-5,12,.22,1.4,mats.cyan);
    for(const side of [-1,1]){box(x+side*3.5,1.7,z-4.58,2.3,2.4,.1,mats.dark);box(x+side*3.5,.3,z-5.3,2.6,.6,.7,mats.pink);}
    const refl=ground(11,7,x,z-9,new T.MeshBasicMaterial({color,transparent:true,opacity:.08,depthWrite:false}),.049);reflections.push(refl);
  }
  sign('SOLMARA',-6,11,219,24,'#fff2c7',Math.PI);
  // Palms line the promenade; broadleaf street trees carry seasonal colors.
  const crowns=[];
  function tree(x,z,palm=false) {
    box(x,3,z,.45,6,.45,mats.trunk);
    if(palm){for(let a=0;a<6;a++)box(x+Math.sin(a*1.047)*1.8,6,z+Math.cos(a*1.047)*1.8,.7,.3,5,mats.leaf,a*1.047);}
    else {crowns.push({x,y:6.4,z});trees.push({x,z});}
    box(x,.25,z,2.6,.4,2.6,mats.curb);
  }
  const lampGlow=new T.MeshBasicMaterial({color:0xffd5a0,transparent:true,opacity:.07,depthWrite:false});
  for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++) {
    tree(i*64-12,j*64+21,i>=3);tree(i*64+12,j*64-18,i>=3);
    for(const side of [-1,1]){
      const x=i*64+side*11,z=j*64-8;
      box(x,3.6,z,.18,7.2,.18,mats.dark);box(x-side*1,7.15,z,2.4,.18,.5,mats.dark);
      box(x-side*1,7.05,z,.7,.12,.45,mats.lamp);
      box(x-side*2,.05,z,7,.012,10,lampGlow);lamps.push({material:lampGlow});
      box(x,2.8,z-1.2,.6,1.6,.5,mats.dark);box(x,3.2,z-1.49,.32,.3,.02,mats.red);
    }
  }
  // Harbor geometry: lit fingers, yachts, bollards, shipping stacks and a beacon.
  ground(95,75,245,280,mats.curb,.02);
  for(let i=0;i<6;i++) {
    const x=195+i*20;box(x,.3,337,3,.8,68,mats.trunk);
    for(let j=0;j<3;j++){
      const z=316+j*19;box(x+6,.5,z,6,1,13,mats.white);box(x+6,1.6,z-1,4,1.2,5,mats.dark);
      box(x+6,5.7,z,.1,8,.1,mats.white);box(x,.9,z,.3,1,.3,mats.cyan);
    }
  }
  for(let i=0;i<12;i++)box(95+i%4*9,1.5,277+Math.floor(i/4)*6,8,3,5,i%2?mats.pink:mats.metal);
  box(310,7,275,3,14,3,mats.white);box(310,14.5,275,5,1.5,5,mats.red);
  // West apron and runway are large enough to recognize in the flight view.
  ground(85,210,-275,192,mats.road,.025);
  for(let z=100;z<290;z+=13)box(-281,.06,z,2,.03,7,mats.white);
  for(const z of [107,281])for(let x=-303;x<-255;x+=6)box(x,.06,z,3,.03,14,mats.white);
  building(-226,208,22,34,9,2);sign('AIR SOLMARA',-226,11,190,23,'#c7eaff',Math.PI);
  box(-225,17,253,6,34,6,mats.white);box(-225,34,253,12,5,12,buildingMats[4]);
  for(let z=112;z<290;z+=12)for(const x of [-311,-250])box(x,.3,z,.4,.4,.4,mats.cyan);
  for(const z of [156,245]){
    box(-279,2,z,3.5,3,18,mats.white);box(-279,2,z,24,.45,5,mats.white);box(-279,4,z-7,.6,5,4,mats.pink);
  }
  const pads=[{x:-256,z:192,y:.12},{x:96,z:96,y:0}];
  // A dedicated roof gives players a real landing target rather than an invisible trigger.
  const roof=roofs.find(r=>r.x>75&&r.x<100&&r.z>75&&r.z<100);
  if(roof){pads[1]={x:roof.x,z:roof.z,y:roof.y+.25};}
  for(const pad of pads){
    const disk=mesh(new T.CylinderGeometry(8.2,8.2,.16,32),mats.dark,pad.x,pad.y,pad.z);
    const ring=mesh(new T.TorusGeometry(7,.19,5,48),mats.yellow,pad.x,pad.y+.13,pad.z);ring.rotation.x=Math.PI/2;
    box(pad.x-1.8,pad.y+.18,pad.z,.65,.08,5,mats.white);box(pad.x+1.8,pad.y+.18,pad.z,.65,.08,5,mats.white);box(pad.x,pad.y+.18,pad.z,4,.08,.65,mats.white);
  }
  // Three physical ramps, not menu actions. Their sloped deck is used by driving physics.
  const ramps=[{x:0,z:226,dir:0},{x:-128,z:45,dir:0},{x:192,z:-174,dir:0}];
  for(const r of ramps){const ramp=mesh(new T.BoxGeometry(7,.5,12),mats.yellow,r.x,1.4,r.z);ramp.rotation.x=.21;sign('JUMP / KEEP IT PINNED',r.x-8,3.5,r.z+5,9,'#ffce75',Math.PI);}
  const crownBatch=new T.InstancedMesh(new T.IcosahedronGeometry(2.35,1),mats.leaf,crowns.length);
  crowns.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(1,1.2,.95);dummy.rotation.set(0,i*.53,0);dummy.updateMatrix();crownBatch.setMatrixAt(i,dummy.matrix);});scene.add(crownBatch);
  for(const [material,entries] of groups){
    const batch=new T.InstancedMesh(boxGeometry,material,entries.length);
    for(let i=0;i<entries.length;i++){const b=entries[i];dummy.position.set(b.x,b.y,b.z);dummy.scale.set(b.w,b.h,b.d);dummy.rotation.set(0,b.ry,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);}
    batch.computeBoundingSphere();scene.add(batch);
  }
  return {colliders,roofs,ramps,pads,mats,groundMat,waterMat,trees,lamps,reflections,buildingMats,sign,water,island};
}

export function solidAt(city,x,z,radius=1,y=0) {
  return city.colliders.some(b=>y<b.h+.3&&Math.abs(x-b.x)<b.w+radius&&Math.abs(z-b.z)<b.d+radius);
}
export function moveOnStreets(city,object,dx,dz,radius=1) {
  const y=object.y||0;
  const x=clamp(object.x+dx,-313,313),z=clamp(object.z+dz,-310,310);
  let hit=false;
  if(!solidAt(city,x,object.z,radius,y))object.x=x;else hit=true;
  if(!solidAt(city,object.x,z,radius,y))object.z=z;else hit=true;
  return hit;
}
export function lineOfSight(city,a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,ay=a.y||1.8,by=b.y||1.8;
  for(const box of city.colliders) {
    let lo=0,hi=1;
    for(const [origin,direction,min,max] of [[a.x,dx,box.x-box.w,box.x+box.w],[a.z,dz,box.z-box.d,box.z+box.d]]) {
      if(Math.abs(direction)<.00001){if(origin<min||origin>max){lo=2;break;}}
      else {let t0=(min-origin)/direction,t1=(max-origin)/direction;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
    }
    const entryY=ay+(by-ay)*Math.max(0,lo),exitY=ay+(by-ay)*Math.min(1,hi);
    if(lo<=hi&&hi>0&&lo<1&&Math.min(entryY,exitY)<box.h)return false;
  }
  return true;
}
export function surfaceHeight(city,x,z) {
  let height=0;
  for(const r of city.roofs)if(Math.abs(x-r.x)<r.w&&Math.abs(z-r.z)<r.d)height=Math.max(height,r.y);
  return height;
}
