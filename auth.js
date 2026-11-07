import {randomBytes, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
export function setupAuth(db){
  db.exec(`CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY,member_id INTEGER UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS invitations(token TEXT PRIMARY KEY,member_id INTEGER UNIQUE REFERENCES members(id) ON DELETE CASCADE);`);
  if(!db.prepare('PRAGMA table_info(events)').all().some(c=>c.name==='host_member_id'))db.exec('ALTER TABLE events ADD COLUMN host_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL');
  const enabled=()=>Boolean(db.prepare('SELECT id FROM accounts LIMIT 1').get());
  const digest=t=>createHash('sha256').update(t).digest('hex');
  const user=req=>{const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('fb_session='))?.slice(11);return token?db.prepare('SELECT a.id,a.member_id,a.email,a.role,m.name FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN members m ON m.id=a.member_id WHERE s.token=? AND s.expires>?').get(digest(token),Date.now())??null:null;};
  const attempts=new Map();
  const password=value=>{if(typeof value!=='string'||value.length<12||value.length>256)throw Error('Use a password between 12 and 256 characters.');const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(value,salt,64).toString('hex');};
  const login=(req,res,id)=>{const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token),id,Date.now()+604800000);res.setHeader('Set-Cookie',`fb_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${req.socket.encrypted||process.env.COOKIE_SECURE==='true'?'; Secure':''}`);};
  return {enabled,user,async handle(req,res,url,body,send){
    if(!url.pathname.startsWith('/api/auth/'))return false;
    if(url.pathname==='/api/auth/session'&&req.method==='GET'){send(res,200,{setup:!enabled(),user:user(req)});return true;}
    if(req.method!=='POST'){send(res,405,{error:'Method not allowed.'});return true;}
    if(req.headers.origin&&req.headers.origin!==`http${req.socket.encrypted?'s':''}://${req.headers.host}`){send(res,403,{error:'Invalid request origin.'});return true;}
    const input=await body(req),action=url.pathname.split('/').pop();
    if(action==='logout'){const token=(req.headers.cookie||'').match(/fb_session=([^;]+)/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.setHeader('Set-Cookie','fb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');send(res,200,{ok:true});return true;}
    if(action==='invite'){if(user(req)?.role!=='admin'){send(res,403,{error:'Only administrators can invite members.'});return true;}const id=Number(input.member_id);if(!db.prepare('SELECT id FROM members WHERE id=?').get(id)||db.prepare('SELECT id FROM accounts WHERE member_id=?').get(id))throw Error('Choose a member without an account.');const token=randomBytes(32).toString('hex');db.prepare('INSERT OR REPLACE INTO invitations VALUES (?,?)').run(digest(token),id);send(res,201,{url:'/#invite='+token});return true;}
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw Error('Enter a valid email address.');
    if(action==='login'){
      const key=req.socket.remoteAddress,entry=attempts.get(key);if(entry&&entry.until>Date.now()&&entry.count>=10){send(res,429,{error:'Too many attempts. Try again in 15 minutes.'});return true;}if(!entry||entry.until<Date.now())attempts.set(key,{count:0,until:Date.now()+900000});attempts.get(key).count++;
      const a=db.prepare('SELECT * FROM accounts WHERE email=?').get(email);const [salt,hash]=(a?.password??'dummy:'+ '0'.repeat(128)).split(':');const candidate=scryptSync(String(input.password??'').slice(0,256),salt,64);if(!a||!timingSafeEqual(candidate,Buffer.from(hash,'hex'))){send(res,401,{error:'Email or password is incorrect.'});return true;}attempts.delete(key);login(req,res,a.id);send(res,200,{ok:true});return true;
    }
    if(!['setup','join'].includes(action)){send(res,404,{error:'Not found.'});return true;}
    if(action==='setup'&&enabled()){send(res,403,{error:'Society already configured. Ask an administrator for an invitation.'});return true;}
    const hash=password(input.password);let memberId;
    db.exec('BEGIN IMMEDIATE');try{
      if(action==='join'){const invite=db.prepare('SELECT member_id FROM invitations WHERE token=?').get(digest(String(input.token??'')));if(!invite)throw Error('Invitation is invalid or already used.');memberId=invite.member_id;}
      else{const name=typeof input.name==='string'?input.name.trim():'';if(!name||name.length>100)throw Error('Enter your name.');memberId=Number(input.member_id);if(!db.prepare('SELECT id FROM members WHERE id=?').get(memberId))memberId=Number(db.prepare('INSERT INTO members(name) VALUES (?)').run(name).lastInsertRowid);}
      const id=Number(db.prepare('INSERT INTO accounts(member_id,email,password,role) VALUES (?,?,?,?)').run(memberId,email,hash,action==='setup'?'admin':'member').lastInsertRowid);if(action==='join')db.prepare('DELETE FROM invitations WHERE member_id=?').run(memberId);db.exec('COMMIT');login(req,res,id);
    }catch(e){db.exec('ROLLBACK');if(e.message.includes('UNIQUE'))throw Error('This email or member already has an account.');throw e;}
    send(res,201,{ok:true});return true;
  }};
}
