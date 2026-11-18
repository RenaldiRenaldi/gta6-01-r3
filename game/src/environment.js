import * as T from '../vendor/three.module.min.js';
import { SEASONS, rng, clamp } from './config.js';
import { thunder } from './audio.js';

export function createEnvironment(scene,city) {
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,toneMapped:false,
    uniforms:{zenith:{value:new T.Color(0x6fa9bf)},horizon:{value:new T.Color(0xf2d2b5)},sunlight:{value:1}},
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 zenith;uniform vec3 horizon;uniform float sunlight;varying vec3 direction;void main(){vec3 d=normalize(direction);float h=clamp(d.y*1.6,0.0,1.0);vec3 color=mix(horizon,zenith,pow(h,0.6));float disc=pow(max(0.0,dot(d,normalize(vec3(-0.65,0.16,0.7)))),800.0);float haze=pow(max(0.0,dot(d,normalize(vec3(-0.65,0.16,0.7)))),12.0);color+=vec3(1.0,0.69,0.37)*(disc*1.8+haze*0.12)*sunlight;gl_FragColor=vec4(pow(color,vec3(0.4545)),1.0);}',
  });
  const dome=new T.Mesh(new T.SphereGeometry(900,32,16),skyMaterial);scene.add(dome);
  const ambient=new T.HemisphereLight(0xc6dbe0,0x77694e,2.3);scene.add(ambient);
  const sun=new T.DirectionalLight(0xffd3a3,2.5);sun.position.set(-130,180,-100);scene.add(sun);
  const random=rng(940),positions=new Float32Array(1800*3);
  for(let i=0;i<1800;i++){positions[i*3]=(random()-.5)*160;positions[i*3+1]=random()*85;positions[i*3+2]=(random()-.5)*160;}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  const particles=new T.Points(geometry,new T.PointsMaterial({color:0xffd0dc,size:.32,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));scene.add(particles);
  const rainPositions=new Float32Array(900*6);
  for(let i=0;i<900;i++){const x=(random()-.5)*130,y=random()*65,z=(random()-.5)*130;rainPositions.set([x,y,z,x-.1,y+.9,z],i*6);}
  const rainGeometry=new T.BufferGeometry();rainGeometry.setAttribute('position',new T.BufferAttribute(rainPositions,3));
  const rain=new T.LineSegments(rainGeometry,new T.LineBasicMaterial({color:0xc5e9ef,transparent:true,opacity:.24,depthWrite:false}));scene.add(rain);
  const env={season:0,hour:17.2,weather:SEASONS[0].weather,wet:.8,ambient,sun,particles,rain,city,dome,skyMaterial,cycle:0,lightning:0,thunderDelay:-1,weatherIndex:0};
  setSeason(env,scene,0);return env;
}
export function setSeason(e,scene,index) {
  e.season=(index+4)%4;const s=SEASONS[e.season];e.weather=s.weather;e.cycle=0;e.wet=s.wet;
  e.city.groundMat.color.setHex(s.ground);e.city.mats.leaf.color.setHex(s.leaf);e.city.mats.roof.color.setHex(e.season===3?0xe4ebec:0xdcd2b8);
  e.city.mats.curb.color.setHex(e.season===3?0xc3d4dc:0xcec6b0);
  e.particles.material.color.setHex(e.season===2?0xf5a755:e.season===3?0xffffff:0xffb4d0);
  e.particles.material.size=e.season===2?.48:e.season===3?.29:.34;
  e.ambient.color.setHex(s.ambient);e.sun.color.setHex(s.sun);
}
export function updateEnvironment(game,dt) {
  const e=game.env,s=SEASONS[e.season];e.hour=(e.hour+dt*.009)%24;e.cycle+=dt;
  if(e.cycle>78){e.cycle=0;e.weatherIndex++;e.weather=e.season===3?'SNOWFALL':e.season===0?['LIGHT SHOWERS','FOG','THUNDERSTORM'][e.weatherIndex%3]:e.season===2?['GOLDEN WIND','FOG','LIGHT SHOWERS'][e.weatherIndex%3]:['CLEAR','THUNDERSTORM','CLEAR'][e.weatherIndex%3];game.notify('WEATHER / '+e.weather);}
  const raining=e.weather==='LIGHT SHOWERS'||e.weather==='THUNDERSTORM';
  e.wet+=(raining||e.season===3?1-e.wet:s.wet-e.wet)*dt*.12;
  e.city.mats.road.roughness=.78-e.wet*.61;e.city.mats.road.metalness=.1+e.wet*.3;
  const night=e.hour<6||e.hour>19.5,twilight=!night&&(e.hour>16||e.hour<8);
  const sky=new T.Color(night?0x101f38:twilight?(e.season===3?0x71869e:0xd3b8b1):s.sky);
  sceneSky(game.scene,sky,e.weather==='FOG'?.008:night?.0034:.0018);
  e.skyMaterial.uniforms.zenith.value.setHex(night?0x07162b:e.season===2?0x6e9cba:0x78afc7);
  e.skyMaterial.uniforms.horizon.value.copy(sky);e.skyMaterial.uniforms.sunlight.value=night?0:1;
  e.dome.visible=e.weather!=='FOG';
  e.ambient.intensity=night?1.2:2.05;e.sun.intensity=night?.22:twilight?2.3:2.7;
  e.sun.position.set(-140,twilight?65:200,-90);
  e.city.buildingMats.forEach(m=>m.emissiveIntensity=night?.56:.13);
  e.city.reflections.forEach(r=>r.material.opacity=e.wet*(night?.66:.16));
  for(const c of [...game.traffic,...game.garage,...game.police.units])for(const beam of c.lights)beam.material.opacity=night?.34:.035;
  e.city.lamps.forEach(r=>r.material.opacity=night?.2:.02);
  e.particles.visible=e.season!==1;e.rain.visible=raining;
  e.particles.position.set(game.player.x,game.player.y,game.player.z);e.rain.position.set(game.player.x,game.player.y,game.player.z);
  const attr=e.particles.geometry.attributes.position;
  for(let i=0;i<attr.count;i++){
    let y=attr.array[i*3+1]-(e.season===3?dt*5:dt*3);
    if(y<0)y+=85;attr.array[i*3+1]=y;
    attr.array[i*3]+=dt*(e.season===2?2.1:.8);if(attr.array[i*3]>80)attr.array[i*3]=-80;
  }
  attr.needsUpdate=true;
  if(raining){const a=e.rain.geometry.attributes.position;for(let i=0;i<a.count;i+=2){const y=a.array[i*3+1]-dt*34;a.array[i*3+1]=y<0?65:y;a.array[(i+1)*3+1]=a.array[i*3+1]+.9;}a.needsUpdate=true;}
  if(e.weather==='THUNDERSTORM'&&Math.random()<dt*.11){e.lightning=.16;e.thunderDelay=.65;}
  if(e.thunderDelay>=0){e.thunderDelay-=dt;if(e.thunderDelay<0)thunder();}
  if(e.lightning>0){e.lightning-=dt;game.scene.background.setHex(0xe2ebff);e.sun.intensity=7;}
  e.city.waterMat.color.setHex(night?0x123e55:e.season===3?0x476d7c:0x297f91);
}
function sceneSky(scene,color,density) {
  scene.background=color;
  if(!scene.fog)scene.fog=new T.FogExp2(color,density);
  scene.fog.color.copy(color);scene.fog.density=density;
}
