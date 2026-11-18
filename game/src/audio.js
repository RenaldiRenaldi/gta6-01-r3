let context, master, motor, motorGain, musicClock=0, beat=0, enabled=true;
export function bootAudio() {
  if(!context) {
    context=new (window.AudioContext||window.webkitAudioContext)();
    master=context.createGain();master.gain.value=.19;master.connect(context.destination);
    motor=context.createOscillator();motor.type='sawtooth';motorGain=context.createGain();motorGain.gain.value=0;
    motor.connect(motorGain).connect(master);motor.start();
  }
  if(context.state==='suspended')context.resume().catch(()=>{});
}
export function tone(f,duration=.12,type='sine',volume=.25,slide=0) {
  if(!context||!enabled)return;
  const osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
  osc.type=type;osc.frequency.setValueAtTime(f,now);if(slide)osc.frequency.exponentialRampToValueAtTime(slide,now+duration);
  gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(gain).connect(master);osc.start(now);osc.stop(now+duration);
}
export function noise(duration=.2,volume=.3) {
  if(!context||!enabled)return;
  const buffer=context.createBuffer(1,Math.floor(context.sampleRate*duration),context.sampleRate),a=buffer.getChannelData(0);
  for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*(1-i/a.length)**2;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume;
  source.connect(gain).connect(master);source.start();
}
export function gunSound(index){noise(index===1?.22:.09,index===1?.8:.45);tone(index===2?90:160,.14,'triangle',.3,35);if(index===1)tone(58,.25,'sine',.35,26);}
export function thunder(){noise(2.4,.7);tone(42,2,'sine',.55,22);}
export function tickAudio(dt,speed,wanted,radioOn) {
  if(!context)return;
  motor.frequency.setTargetAtTime(35+Math.abs(speed)*3.4,context.currentTime,.1);
  motorGain.gain.setTargetAtTime(Math.abs(speed)>1?.05:0,context.currentTime,.1);
  musicClock+=dt;
  if(musicClock>.32){musicClock-=.32;beat++;
    if(radioOn){const notes=[110,130.81,146.83,98];tone(notes[Math.floor(beat/8)%4],.25,'triangle',.15);if(beat%4===0){tone(65,.16,'sine',.5,30);noise(.04,.1);}if(beat%2)tone([440,523.25,587.33,392][beat%4],.2,'sine',.045);}
    if(wanted&&beat%4===0)tone(beat%8?650:870,.28,'sine',.06);
  }
}
export function toggleSound(){enabled=!enabled;if(master)master.gain.value=enabled?.19:0;return enabled;}
