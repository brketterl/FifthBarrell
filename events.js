import {catalog} from './catalog.js';
export function setupEvents(db) {
  if(!db.prepare('PRAGMA table_info(pours)').all().some(c=>c.name==='catalog_id')) db.exec('ALTER TABLE pours ADD COLUMN catalog_id TEXT');
  for(const field of ['label','expression'])if(!db.prepare('PRAGMA table_info(pours)').all().some(c=>c.name===field))db.exec(`ALTER TABLE pours ADD COLUMN ${field} TEXT`);
  if(!db.prepare('PRAGMA table_info(events)').all().some(c=>c.name==='blind_mode'))db.exec('ALTER TABLE events ADD COLUMN blind_mode INTEGER NOT NULL DEFAULT 0');
  for(const [field,type] of [['revealed','INTEGER NOT NULL DEFAULT 1'],['blind_label',"TEXT NOT NULL DEFAULT ''"]])if(!db.prepare('PRAGMA table_info(pours)').all().some(c=>c.name===field))db.exec(`ALTER TABLE pours ADD COLUMN ${field} ${type}`);
  const date=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
  const text=(value,required=false)=>{
    if (value!=null&&typeof value!=='string') throw new Error('Invalid text field.');
    const cleaned=(value??'').trim();
    if ((required&&!cleaned)||cleaned.length>250) throw new Error('Enter a name or description up to 250 characters.');
    return cleaned;
  };
  return {
    all:()=>db.prepare('SELECT * FROM events ORDER BY event_date DESC,id DESC').all(),
    pours:()=>db.prepare('SELECT * FROM pours ORDER BY id').all(),
    create:input=>{
      const name=text(input.name,true),location=text(input.location);
      if(!date(input.event_date)) throw new Error('Enter a valid event date.');
      if(input.tasting_mode!=null&&!['open','blind'].includes(input.tasting_mode))throw new Error('Choose open-label or blind tasting.');
      return {id:Number(db.prepare('INSERT INTO events(name,event_date,location,blind_mode) VALUES (?,?,?,?)').run(name,input.event_date,location,input.tasting_mode==='blind'?1:0).lastInsertRowid)};
    },
    addPour:(eventId,input)=>{
      const event=db.prepare('SELECT * FROM events WHERE id=?').get(eventId);if(!event)return null;
      if(event.blind_mode){
        if(['bottle_id','catalog_id','distillery','proof','release','label','expression'].some(k=>input[k]!=null&&input[k]!==''))throw new Error('Blind samples accept only an anonymous sample name. Add the actual bourbon at reveal.');
        const sample=text(input.whiskey_name,true);
        if(db.prepare('SELECT id FROM pours WHERE event_id=? AND blind_label=? COLLATE NOCASE').get(eventId,sample))throw new Error('Use a unique sample name for this flight.');
        return {id:Number(db.prepare('INSERT INTO pours(event_id,whiskey_name,revealed,blind_label) VALUES (?,?,0,?)').run(eventId,sample,sample).lastInsertRowid)};
      }
      let b={whiskey_name:text(input.whiskey_name,true),distillery:text(input.distillery),release:text(input.release),proof:null,bottle_id:null,label:text(input.label),expression:text(input.expression),catalog_id:text(input.catalog_id)||null};
      if(input.proof!=null&&input.proof!=='') {
        b.proof=Number(input.proof);
        if(typeof input.proof==='boolean'||!Number.isFinite(b.proof)||b.proof<0||b.proof>200) throw new Error('Proof must be between 0 and 200.');
      }
      if(input.bottle_id!=null&&input.bottle_id!=='') {
        const bottle=db.prepare('SELECT * FROM bottles WHERE id=?').get(Number(input.bottle_id));
        if(!bottle) throw new Error('Cabinet bottle not found.');
        const source=catalog.find(record=>record.id===bottle.catalog_id);
        b={whiskey_name:bottle.name,distillery:bottle.distillery,release:[bottle.release,bottle.year].filter(Boolean).join(' · '),proof:bottle.proof,bottle_id:bottle.id,label:bottle.label??source?.label??'',expression:bottle.expression??source?.expression??'',catalog_id:bottle.catalog_id??null};
      }
      return {id:Number(db.prepare('INSERT INTO pours(event_id,bottle_id,whiskey_name,distillery,release,proof,catalog_id,label,expression) VALUES (?,?,?,?,?,?,?,?,?)').run(eventId,b.bottle_id,b.whiskey_name,b.distillery,b.release,b.proof,b.catalog_id,b.label,b.expression).lastInsertRowid)};
    },
    reveal:(id,input)=>{
      const pour=db.prepare('SELECT p.*,e.blind_mode FROM pours p JOIN events e ON e.id=p.event_id WHERE p.id=?').get(id);
      if(!pour)return null;
      if(!pour.blind_mode||pour.revealed)throw new Error('This pour is not an unrevealed blind sample.');
      let identity={whiskey_name:text(input.whiskey_name,true),distillery:text(input.distillery),release:text(input.release),label:text(input.label),expression:text(input.expression),catalog_id:text(input.catalog_id)||null,bottle_id:null,proof:null};
      if(input.proof!=null&&input.proof!==''){
        identity.proof=Number(input.proof);if(typeof input.proof==='boolean'||!Number.isFinite(identity.proof)||identity.proof<0||identity.proof>200)throw new Error('Proof must be between 0 and 200.');
      }
      if(input.bottle_id!=null&&input.bottle_id!==''){
        const b=db.prepare('SELECT * FROM bottles WHERE id=?').get(Number(input.bottle_id));if(!b)throw new Error('Cabinet bottle not found.');
        const source=catalog.find(record=>record.id===b.catalog_id);
        identity={whiskey_name:b.name,distillery:b.distillery,release:[b.release,b.year].filter(Boolean).join(' · '),label:b.label??source?.label??'',expression:b.expression??source?.expression??'',catalog_id:b.catalog_id??null,bottle_id:b.id,proof:b.proof};
      }
      db.exec('BEGIN');
      try{
        const keys=Object.keys(identity);db.prepare(`UPDATE pours SET ${keys.map(k=>`${k}=?`).join(',')},revealed=1 WHERE id=?`).run(...keys.map(k=>identity[k]),id);
        db.prepare('UPDATE tastings SET whiskey_name=?,distillery=?,release=?,proof=?,bottle_id=? WHERE event_pour_id=?').run(identity.whiskey_name,identity.distillery,identity.release,identity.proof,identity.bottle_id,id);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {id};
    },
    remove:id=>Boolean(db.prepare('DELETE FROM events WHERE id=?').run(id).changes),
    removePour:id=>Boolean(db.prepare('DELETE FROM pours WHERE id=?').run(id).changes)
  };
}
