import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchCatalog } from './catalog.js';
import { setupTastings, tastingStages } from './tasting.js';
import { setupEvents } from './events.js';

const root = dirname(fileURLToPath(import.meta.url));
export const ratings = ['Favorite', 'Daily Drinker', 'Just OK', 'Do not Buy Again'];
export function createApp(dbPath = join(root, 'data', 'society.sqlite')) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS bottles (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    name TEXT NOT NULL, distillery TEXT NOT NULL DEFAULT '', proof REAL, year INTEGER, rating TEXT NOT NULL,
    remaining REAL NOT NULL, price REAL, bourbon_notes TEXT NOT NULL DEFAULT '', member_notes TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
  const tastings=setupTastings(db);
  const events=setupEvents(db);
  const bottleColumns=new Set(db.prepare('PRAGMA table_info(bottles)').all().map(c=>c.name));
  for(const [name,type] of [['catalog_id','TEXT'],['age_years','REAL'],['size_ml','REAL'],['release','TEXT']])if(!bottleColumns.has(name))db.exec(`ALTER TABLE bottles ADD COLUMN ${name} ${type}`);
  const send = (res, status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };
  async function body(req) {
    let value=''; for await (const part of req) { value += part; if (value.length>65536) throw new Error('Request is too large.'); }
    try { return JSON.parse(value); } catch { throw new Error('Please send valid JSON.'); }
  }
  function bottle(input) {
    const result = {};
    for (const key of ['name','distillery','bourbon_notes','member_notes','release']) {
      if (input[key] != null && typeof input[key] !== 'string') throw new Error('Invalid text field.');
      result[key]=(input[key] || '').trim();
      if (result[key].length>10000) throw new Error('Text is too long.');
    }
    if (!result.name) throw new Error('Bottle name is required.');
    if(input.catalog_id!=null&&typeof input.catalog_id!=='string')throw new Error('Invalid catalog reference.');
    result.catalog_id=input.catalog_id?.trim()||null;
    if(result.catalog_id?.length>250)throw new Error('Catalog reference is too long.');
    if (!ratings.includes(input.rating)) throw new Error('Choose a bottle preference.');
    result.rating=input.rating;
    for (const [key,min,max,optional] of [['member_id',1,Number.MAX_SAFE_INTEGER,false],['proof',0,200,true],['year',1700,2200,true],['remaining',0,100,false],['price',0,10000000,true],['age_years',0,200,true],['size_ml',1,100000,true]]) {
      const raw=input[key];
      if (optional && (raw==null || raw==='')) { result[key]=null; continue; }
      if (raw==null || raw==='' || typeof raw==='boolean') throw new Error(`Please enter ${key.replace('_',' ')}.`);
      const n=Number(raw);
      if (!Number.isFinite(n)||n<min||n>max||(['year','member_id'].includes(key)&&!Number.isInteger(n))) throw new Error(`Invalid ${key.replace('_',' ')}.`);
      result[key]=n;
    }
    if (!db.prepare('SELECT id FROM members WHERE id=?').get(result.member_id)) throw new Error('Choose an existing member.');
    return result;
  }
  const handler = async (req,res) => {
    const url = new URL(req.url,'http://localhost');
    try {
      if (url.pathname==='/api/state' && req.method==='GET') return send(res,200,{members:db.prepare('SELECT * FROM members ORDER BY name COLLATE NOCASE').all(),bottles:db.prepare('SELECT * FROM bottles ORDER BY created_at DESC,id DESC').all(),tastings:tastings.all(),tastingStages,events:events.all(),pours:events.pours()});
      if (url.pathname==='/api/events' && req.method==='POST') return send(res,201,events.create(await body(req)));
      const eventMatch=url.pathname.match(/^\/api\/events\/(\d+)$/);
      const eventPours=url.pathname.match(/^\/api\/events\/(\d+)\/pours$/);
      if (eventPours && req.method==='POST') {
        const saved=events.addPour(Number(eventPours[1]),await body(req));
        return send(res,saved?201:404,saved||{error:'Event not found.'});
      }
      const pourMatch=url.pathname.match(/^\/api\/pours\/(\d+)$/);
      if ((eventMatch||pourMatch) && req.method==='DELETE') {
        const removed=eventMatch?events.remove(Number(eventMatch[1])):events.removePour(Number(pourMatch[1]));
        return send(res,removed?200:404,removed?{ok:true}:{error:'Event or pour not found.'});
      }
      const tastingMatch=url.pathname.match(/^\/api\/tastings\/(\d+)$/);
      if ((url.pathname==='/api/tastings' && req.method==='POST') || (tastingMatch && req.method==='PUT')) {
        const saved=tastings.save(await body(req),tastingMatch?Number(tastingMatch[1]):null);
        return send(res,saved?(tastingMatch?200:201):404,saved||{error:'Tasting not found.'});
      }
      if (tastingMatch && req.method==='DELETE') {
        const removed=tastings.remove(Number(tastingMatch[1]));
        return send(res,removed?200:404,removed?{ok:true}:{error:'Tasting not found.'});
      }
      if (url.pathname==='/api/catalog' && req.method==='GET') {
        return send(res,200,searchCatalog(url.searchParams.get('q')||'',{source:url.searchParams.get('source')||'',offset:url.searchParams.get('offset')||0}));
      }
      if (url.pathname==='/api/members' && req.method==='POST') {
        const input=await body(req); const name=typeof input.name==='string'?input.name.trim():'';
        if (!name||name.length>100) throw new Error('Enter a member name (up to 100 characters).');
        const id=Number(db.prepare('INSERT INTO members(name) VALUES (?)').run(name).lastInsertRowid);
        return send(res,201,{id,name});
      }
      const member=url.pathname.match(/^\/api\/members\/(\d+)$/);
      if (member && req.method==='DELETE') {
        if (!db.prepare('DELETE FROM members WHERE id=?').run(Number(member[1])).changes) return send(res,404,{error:'Member not found.'});
        return send(res,200,{ok:true});
      }
      const match=url.pathname.match(/^\/api\/bottles\/(\d+)$/);
      if ((url.pathname==='/api/bottles' && req.method==='POST') || (match && req.method==='PUT')) {
        const b=bottle(await body(req)); const keys=Object.keys(b);
        if (match) {
          const changed=db.prepare(`UPDATE bottles SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...keys.map(k=>b[k]),Number(match[1])).changes;
          if (!changed) return send(res,404,{error:'Bottle not found.'});
          return send(res,200,{ok:true});
        }
        const id=Number(db.prepare(`INSERT INTO bottles (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>b[k])).lastInsertRowid);
        return send(res,201,{id,...b});
      }
      if (match && req.method==='DELETE') {
        if (!db.prepare('DELETE FROM bottles WHERE id=?').run(Number(match[1])).changes) return send(res,404,{error:'Bottle not found.'});
        return send(res,200,{ok:true});
      }
      if (url.pathname.startsWith('/api/')) return send(res,404,{error:'Not found.'});
      if (!['GET','HEAD'].includes(req.method)) return send(res,405,{error:'Method not allowed.'});
      const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
      const file=files[url.pathname]; if (!file) return send(res,404,{error:'Not found.'});
      res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      res.end(req.method==='HEAD'?undefined:readFileSync(join(root,'public',file)));
    } catch(error) { send(res,400,{error:error.message}); }
  };
  return {handler,close:()=>db.close()};
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const app=createApp(process.env.DB_PATH); const server=http.createServer(app.handler);
  server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`Fifth Barrel Society listening on port ${server.address().port}`));
}
