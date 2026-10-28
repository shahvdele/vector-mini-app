import {newState,validateState} from './domain.mjs';
const HEAD='vx2_head',PREFIX='vx2_c_',CHUNK=3800,MAX_CHUNKS=300;
export class CloudConflict extends Error{constructor(){super('Цели изменились на другом устройстве. Загружена свежая версия — повторите действие.');this.name='CloudConflict';}}
export class CloudUncertain extends Error{constructor(){super('Telegram не подтвердил сохранение. Заново откройте приложение, чтобы проверить данные.');this.name='CloudUncertain';}}
function descriptor(d){if(!d||!/^\d{13}_[a-f0-9]{16}$/.test(d.id)||!Number.isInteger(d.count)||d.count<1||d.count>MAX_CHUNKS||!/^[a-f0-9]{64}$/.test(d.hash)||d.encoding!=='gzip-base64')throw Error('Повреждён указатель облачной копии');return d;}
function parseHead(raw){if(!raw)return null;const h=JSON.parse(raw);if(h.version!==2)throw Error('Неизвестная версия облачных данных');descriptor(h.current);if(h.previous)descriptor(h.previous);return h;}
const key=(d,i)=>`${PREFIX}${d.id}_${i}`;
const keys=d=>d?Array.from({length:d.count},(_,i)=>key(d,i)):[];
async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function compress(bytes){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());}
async function decompress(bytes){const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let total=0;const chunks=[];try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>3000000)throw Error('Облачная копия превышает допустимый размер');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const out=new Uint8Array(total);let n=0;for(const c of chunks){out.set(c,n);n+=c.length;}return out;}
function base64(bytes){let out='';for(let i=0;i<bytes.length;i+=24000)out+=String.fromCharCode(...bytes.subarray(i,i+24000));return btoa(out);}
const unbase64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export class TelegramCloudStore{
 constructor(api,{timeout=20000}={}){this.api=api;this.timeout=timeout;this.uncertain=false;this.writing=false;}
 call(method,...args){return new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>{settled=true;if(method==='setItem')this.uncertain=true;reject(method==='setItem'?new CloudUncertain():Error('Облако Telegram не ответило. Проверьте интернет и повторите.'));},this.timeout);try{this.api[method](...args,(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(Error('Ошибка Telegram CloudStorage: '+String(error)));else if(method==='setItem'&&result!==true)reject(Error('Telegram не сохранил данные'));else resolve(result);});}catch(e){settled=true;clearTimeout(timer);reject(e);}});}
 async readVersion(d){const all={};const names=keys(d);for(let i=0;i<names.length;i+=50)Object.assign(all,await this.call('getItems',names.slice(i,i+50)));const encoded=names.map(k=>{if(typeof all[k]!=='string'||!all[k])throw Error('Не хватает части облачной копии');return all[k];}).join('');const packed=unbase64(encoded);if(await hash(packed)!==d.hash)throw Error('Контрольная сумма облачной копии не совпала');return validateState(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await decompress(packed))));}
 async load(){const head=parseHead(await this.call('getItem',HEAD));if(!head)return {state:newState(),revision:null,recovered:false};let state,recovered=false;try{state=await this.readVersion(head.current);}catch(error){if(!head.previous)throw error;state=await this.readVersion(head.previous);recovered=true;}return {state,revision:head.current.id,recovered};}
 async write(state,expected){if(this.uncertain)throw new CloudUncertain();if(this.writing)throw Error('Дождитесь окончания сохранения');this.writing=true;let staged=[],committed=false;try{validateState(state);const raw=await this.call('getItem',HEAD),head=parseHead(raw);if((head?.current.id??null)!==expected)throw new CloudConflict();const packed=await compress(new TextEncoder().encode(JSON.stringify(state))),encoded=base64(packed),count=Math.ceil(encoded.length/CHUNK);if(count>MAX_CHUNKS)throw Error('Облачная копия слишком большая. Экспортируйте данные и удалите лишние цели.');const random=[...crypto.getRandomValues(new Uint8Array(8))].map(v=>v.toString(16).padStart(2,'0')).join(''),current={id:Date.now()+'_'+random,count,hash:await hash(packed),encoding:'gzip-base64'};
 const existing=await this.call('getKeys');if(existing.length+count+(!existing.includes(HEAD)?1:0)>1024)throw Error('В облаке Telegram недостаточно места. Сохраните резервную копию.');
 staged=keys(current);for(let i=0;i<count;i++)await this.call('setItem',staged[i],encoded.slice(i*CHUNK,(i+1)*CHUNK));
 // Telegram has no compare-and-set; this detects stale writers but cannot eliminate a simultaneous commit race.
 if(await this.call('getItem',HEAD)!==raw)throw new CloudConflict();
 await this.call('setItem',HEAD,JSON.stringify({version:2,current,previous:head?.current??null}));committed=true;
 const verified=parseHead(await this.call('getItem',HEAD));if(verified?.current.id!==current.id)throw new CloudConflict();
 // Keep one previous complete copy. Cleanup is best effort and never touches other bots' namespaces or current data.
 if(head?.previous){try{await this.call('removeItems',keys(head.previous));}catch{}}
 return {revision:current.id};
 }catch(error){if(committed&&!(error instanceof CloudConflict)){this.uncertain=true;throw new CloudUncertain();}if(!committed&&!this.uncertain&&staged.length){try{await this.call('removeItems',staged);}catch{}}throw error;}finally{this.writing=false;}}
}
