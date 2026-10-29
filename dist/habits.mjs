const DAY=86400000;
export function dateKey(at,zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));}
export function ordinal(day){const [y,m,d]=day.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/DAY);}
export function dayFromOrdinal(n){return new Date(n*DAY).toISOString().slice(0,10);}
export function validateHabit(g){if(g.kind!==undefined&&!['goal','habit'].includes(g.kind))throw Error('Неизвестный тип цели');if(g.kind!=='habit')return;try{dateKey(Date.now(),g.timeZone);if(typeof g.timeZone!=='string')throw Error();}catch{throw Error('Некорректный часовой пояс привычки');}if(!Array.isArray(g.checkins)||g.checkins.length>3660)throw Error('Некорректные отметки привычки');const seen=new Set();for(const c of g.checkins){if(!c||typeof c.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.day)||dayFromOrdinal(ordinal(c.day))!==c.day||seen.has(c.day)||!Number.isSafeInteger(c.at)||c.at<0||c.at>8640000000000000)throw Error('Некорректная ежедневная отметка');seen.add(c.day);}}
export function habitStats(g,now=Date.now()){
 const today=dateKey(now,g.timeZone),start=ordinal(dateKey(g.startAt,g.timeZone)),end=ordinal(dateKey(g.deadlineAt-1,g.timeZone)),valid=g.checkins.filter(c=>ordinal(c.day)>=start&&ordinal(c.day)<=end),days=new Set(valid.map(c=>ordinal(c.day))),sorted=[...days].sort((a,b)=>a-b);
 let best=0,run=0,prev=-Infinity;for(const n of sorted){run=n===prev+1?run+1:1;best=Math.max(best,run);prev=n;}
 const t=ordinal(today);let cursor=days.has(t)?t:t-1,current=0;while(days.has(cursor)){current++;cursor--;}
 const planned=Math.max(1,end-start+1),elapsed=Math.max(0,Math.min(end,t)-start+1);
 return {today,done:days.has(t),current,best,count:days.size,planned,elapsed,percent:Math.min(100,Math.round(days.size/planned*100)),consistency:elapsed?Math.round([...days].filter(d=>d<=t).length/elapsed*100):0,canCheck:!g.completedAt&&now>=g.startAt&&now<g.deadlineAt};
}
export function toggleToday(g,now=Date.now()){const s=habitStats(g,now);if(!s.canCheck)throw Error('Отметка доступна только в период активной привычки');if(s.done)g.checkins=g.checkins.filter(c=>c.day!==s.today);else g.checkins.push({day:s.today,at:now});return !s.done;}
