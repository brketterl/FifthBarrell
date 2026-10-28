import {catalog} from './catalog.js';
export function setupEvents(db) {
  if(!db.prepare('PRAGMA table_info(pours)').all().some(c=>c.name==='catalog_id')) db.exec('ALTER TABLE pours ADD COLUMN catalog_id TEXT');
  for(const field of ['label','expression'])if(!db.prepare('PRAGMA table_info(pours)').all().some(c=>c.name===field))db.exec(`ALTER TABLE pours ADD COLUMN ${field} TEXT`);
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
      return {id:Number(db.prepare('INSERT INTO events(name,event_date,location) VALUES (?,?,?)').run(name,input.event_date,location).lastInsertRowid)};
    },
    addPour:(eventId,input)=>{
      if(!db.prepare('SELECT id FROM events WHERE id=?').get(eventId)) return null;
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
    remove:id=>Boolean(db.prepare('DELETE FROM events WHERE id=?').run(id).changes),
    removePour:id=>Boolean(db.prepare('DELETE FROM pours WHERE id=?').run(id).changes)
  };
}
