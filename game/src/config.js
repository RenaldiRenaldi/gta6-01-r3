export const TITLE = 'Twelve Debts — A Solmara Story';
export const BLOCK = 64, LIMIT = 294, ROAD = 20;
export const SEASONS = [
  { name:'SPRING', weather:'LIGHT SHOWERS', sky:0xa2bdc8, ground:0x88aa80, leaf:0xf4b2c6, ambient:0xbddbdc, sun:0xffdfba, wet:.8 },
  { name:'SUMMER', weather:'CLEAR', sky:0x8ebeca, ground:0xa2aa76, leaf:0x358d6b, ambient:0xb7d4e0, sun:0xffcf8e, wet:.2 },
  { name:'AUTUMN', weather:'GOLDEN WIND', sky:0xb4b9c2, ground:0xb08a5c, leaf:0xd97936, ambient:0xd9c3a9, sun:0xffbd79, wet:.4 },
  { name:'WINTER', weather:'SNOWFALL', sky:0x647a94, ground:0xc8d9df, leaf:0x829f9a, ambient:0xa9c1e4, sun:0xddeaff, wet:1 },
];
export const WEAPONS = [
  { name:'Kestrel 9', short:'PISTOL', range:65, damage:36, spread:.045, pellets:1, cooldown:.27, price:180, rounds:48 },
  { name:'Breaker 12', short:'SHOTGUN', range:29, damage:27, spread:.22, pellets:7, cooldown:.88, price:750, rounds:24 },
  { name:'Longline .30', short:'RIFLE', range:150, damage:85, spread:.015, pellets:1, cooldown:.62, price:1150, rounds:36 },
];
export const SERVICES = [
  { name:'Pearl House', x:-13,z:-64,kind:'safe', color:0xffbd85 },
  { name:'Palmetto Customs', x:15,z:-64,kind:'garage', color:0x55eed1 },
  { name:'Estrella Outfitters',x:-14,z:0,kind:'arms',color:0xff6e83 },
  { name:'Air Solmara',x:-256,z:192,kind:'heli',color:0x86d8ff },
];
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const headingTo = (a,b) => Math.atan2(b.x-a.x,b.z-a.z);
export const wrap = a => Math.atan2(Math.sin(a),Math.cos(a));
export function rng(seed=18419) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
export function district(p) {
  if(p.x < -210 && p.z > 100) return 'AIRPORT / WEST APRON';
  if(p.z > 220 && p.x > 70) return 'LANTERN MARINA';
  if(p.x > 180) return 'SUNBREAK PROMENADE';
  if(p.x > 25 && p.z > 15 && p.z < 200) return 'THE GLASS QUARTER';
  if(p.z < -150) return 'ALTA VISTA';
  if(p.x < -110) return 'OLD CORAL';
  return 'PEARL STREET';
}
