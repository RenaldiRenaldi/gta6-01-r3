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
    return s;
  } catch { return freshSave(); }
}
export function saveGame(s) {
  try { localStorage.setItem(KEY,JSON.stringify(s));return true; }
  catch { return false; }
}
