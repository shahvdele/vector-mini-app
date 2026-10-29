import http from 'node:http';
import {readFile} from 'node:fs/promises';
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',mjs:'text/javascript; charset=utf-8',svg:'image/svg+xml'};
const files=new Set(['index.html','app.mjs','cloud.mjs','habits.mjs','domain.mjs','style.css','icon.svg']);
const server=http.createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!files.has(name)){res.writeHead(404);return res.end();}try{res.writeHead(200,{'Content-Type':mime[name.split('.').pop()],'Cache-Control':'no-cache'});res.end(await readFile(new URL('./dist/'+name,import.meta.url)));}catch{res.writeHead(500);res.end();}});server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Вектор: http://localhost:'+(process.env.PORT||4173)));
