import {validateHabit,habitStats} from './habits.mjs';
export const DAY=86400000;
export function clock(goal,now=Date.now()) {
 const end=goal.completedAt??now;
 const elapsed=Math.max(0,end-goal.startAt);
 const remaining=Math.max(0,goal.deadlineAt-end);
 const duration=goal.durationMs;
 return {elapsed,remaining,daysLeft:Math.ceil(remaining/DAY),scheduled:goal.startAt>now,overdue:!goal.completedAt&&now>goal.deadlineAt,timeProgress:Math.min(100,Math.max(0,(end-goal.startAt)/(goal.deadlineAt-goal.startAt)*100)),timerRemaining:Math.max(0,duration-elapsed),timerExpired:elapsed>=duration};
}
export function split(ms){let s=Math.floor(Math.max(0,ms)/1000);return [Math.floor(s/86400),Math.floor(s/3600)%24,Math.floor(s/60)%60,s%60];}
export function progress(g){return g.kind==='habit'?habitStats(g).percent:g.actions.length?Math.round(g.actions.filter(a=>a.doneAt).length/g.actions.length*100):g.completedAt?100:0;}
export function validateGoal(g){
 if(!g||typeof g!=='object')throw Error('Некорректная цель');
 if(typeof g.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(g.id))throw Error('Некорректный идентификатор');
 if(typeof g.title!=='string'||!g.title.trim()||g.title.length>100)throw Error('Название: от 1 до 100 символов');
 if(typeof g.description!=='string'||g.description.length>2000)throw Error('Описание: не более 2000 символов');
 for(const k of ['startAt','deadlineAt','createdAt','updatedAt'])if(!Number.isSafeInteger(g[k])||g[k]<0||g[k]>8640000000000000)throw Error('Некорректная дата');
 if(g.deadlineAt<=g.startAt)throw Error('Дедлайн должен быть позже начала');
 if(!Number.isSafeInteger(g.durationMs)||g.durationMs<60000||g.durationMs>3650*DAY)throw Error('Таймер: от минуты до 3650 дней');
 if(g.completedAt!==null&&(!Number.isSafeInteger(g.completedAt)||g.completedAt<g.startAt))throw Error('Некорректное время завершения');
 if(!['work','health','learning','personal'].includes(g.category))throw Error('Некорректная категория');
 if(!Array.isArray(g.actions)||g.actions.length>200)throw Error('Не более 200 действий');
 const ids=new Set();for(const a of g.actions){if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.title!=='string'||!a.title.trim()||a.title.length>200||a.doneAt!==null&&(!Number.isSafeInteger(a.doneAt)||a.doneAt<0))throw Error('Некорректное действие');ids.add(a.id);}
 validateHabit(g);
 return g;
}
export function validateState(s){if(!s||s.version!==1||!Array.isArray(s.goals)||s.goals.length>300||!Array.isArray(s.events)||s.events.length>5000)throw Error('Неверный формат данных');const ids=new Set();for(const g of s.goals){validateGoal(g);if(ids.has(g.id))throw Error('Повтор цели');ids.add(g.id);}for(const e of s.events)if(!e||typeof e.id!=='string'||typeof e.text!=='string'||e.text.length>500||!Number.isSafeInteger(e.at)||e.at<0||e.at>8640000000000000)throw Error('Некорректная история');if(new TextEncoder().encode(JSON.stringify(s)).length>2900000)throw Error("Достигнут предел данных 2,9 МБ. Сохраните резервную копию и удалите лишние цели.");return s;}
export function localInput(ms){const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function parseLocal(value){const d=new Date(value);if(!Number.isFinite(d.getTime())||localInput(d.getTime())!==value)throw Error('Это местное время не существует. Выберите другое время.');return d.getTime();}
export function newState(){return {version:1,goals:[],events:[]};}
