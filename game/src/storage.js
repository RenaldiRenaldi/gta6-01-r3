const KEY = 'twelve-debts-r3-v1';
export function freshSave() {
  return { version:1,cash:2800,done:0,weapons:[0],ammo:[72,0,0],upgrades:[],packages:[],races:[null,null,null],jumps:[],season:0,hour:17.2 };
}
export function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if(!saved || saved.version!==1) return freshSave();
    const s={...freshSave(),...saved};
    s.done=Math.max(0,Math.min(12,Number(s.done)||0));
    for(const k of ['weapons','ammo','upgrades','packages','races','jumps']) if(!Array.isArray(s[k])) s[k]=freshSave()[k];
    s.cash=Math.max(0,Number.isFinite(s.cash)?s.cash:2800);
    s.weapons=[...new Set([0,...s.weapons.filter(i=>[0,1,2].includes(i))])];
    s.ammo=[0,1,2].map(i=>Math.max(0,Math.floor(Number(s.ammo[i])||0)));
    s.packages=[...new Set(s.packages.filter(i=>Number.isInteger(i)&&i>=0&&i<15))];
    s.jumps=[...new Set(s.jumps.filter(i=>Number.isInteger(i)&&i>=0&&i<3))];
    s.races=[0,1,2].map(i=>Number.isFinite(s.races[i])&&s.races[i]>0?s.races[i]:null);
    return s;
  } catch { return freshSave(); }
}
export function saveGame(s) {
  try { localStorage.setItem(KEY,JSON.stringify(s));return true; }
  catch { return false; }
}
