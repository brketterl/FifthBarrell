// Original tasting vocabulary; no third-party flavor datasets are imported.
export const tastingStages = {
  nose: ['Vanilla', 'Caramel', 'Fruit', 'Floral', 'Oak', 'Spice'],
  palate: ['Sweetness', 'Fruit', 'Baking spice', 'Wood', 'Grain', 'Chocolate', 'Nutty'],
  finish: ['Duration', 'Dryness', 'Warmth', 'Sweetness', 'Oak', 'Pepper'],
  mouthfeel: ['Body', 'Silky', 'Oily', 'Creamy', 'Drying']
};

export function setupTastings(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, event_date TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS pours (
    id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    bottle_id INTEGER REFERENCES bottles(id) ON DELETE SET NULL,
    whiskey_name TEXT NOT NULL, distillery TEXT NOT NULL DEFAULT '',
    release TEXT NOT NULL DEFAULT '', proof REAL
  );
  CREATE TABLE IF NOT EXISTS tastings (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    bottle_id INTEGER REFERENCES bottles(id) ON DELETE SET NULL,
    whiskey_name TEXT NOT NULL, distillery TEXT NOT NULL DEFAULT '',
    release TEXT NOT NULL DEFAULT '', proof REAL,
    tasted_on TEXT NOT NULL, setting TEXT NOT NULL DEFAULT '',
    score REAL NOT NULL CHECK(score >= 1 AND score <= 10),
    nose_notes TEXT NOT NULL DEFAULT '', palate_notes TEXT NOT NULL DEFAULT '',
    finish_notes TEXT NOT NULL DEFAULT '', mouthfeel_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '', flavors TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  if (!db.prepare('PRAGMA table_info(tastings)').all().some(c=>c.name==='event_pour_id')) db.exec('ALTER TABLE tastings ADD COLUMN event_pour_id INTEGER REFERENCES pours(id) ON DELETE SET NULL');
  function validate(input) {
    const result={};
    for (const key of ['whiskey_name','distillery','release','tasted_on','setting','nose_notes','palate_notes','finish_notes','mouthfeel_notes','notes']) {
      if (input[key]!=null && typeof input[key]!=='string') throw new Error('Invalid tasting text.');
      result[key]=(input[key]??'').trim();
      if (result[key].length>10000) throw new Error('Tasting text is too long.');
    }
    if (!result.whiskey_name) throw new Error('Enter the whiskey you tasted.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.tasted_on) || !Number.isFinite(Date.parse(result.tasted_on)) || new Date(result.tasted_on).toISOString().slice(0,10)!==result.tasted_on) throw new Error('Enter a valid tasting date.');
    for (const [key,min,max,optional] of [['member_id',1,Number.MAX_SAFE_INTEGER,false],['bottle_id',1,Number.MAX_SAFE_INTEGER,true],['event_pour_id',1,Number.MAX_SAFE_INTEGER,true],['proof',0,200,true],['score',1,10,false]]) {
      const raw=input[key];
      if (optional && (raw==null||raw==='')) {result[key]=null;continue;}
      const n=Number(raw);
      if (raw==null||raw===''||typeof raw==='boolean'||!Number.isFinite(n)||n<min||n>max||(key.endsWith('_id')&&!Number.isInteger(n))) throw new Error(`Invalid tasting ${key.replace('_',' ')}.`);
      result[key]=n;
    }
    if (!db.prepare('SELECT id FROM members WHERE id=?').get(result.member_id)) throw new Error('Choose an existing member.');
    if (result.bottle_id!==null && !db.prepare('SELECT id FROM bottles WHERE id=?').get(result.bottle_id)) throw new Error('The cabinet bottle no longer exists. Choose another bottle or use manual entry.');
    if (result.event_pour_id!==null) {
      const pour=db.prepare('SELECT * FROM pours WHERE id=?').get(result.event_pour_id);
      if (!pour) throw new Error('This event pour no longer exists.');
      const duplicate=db.prepare('SELECT id FROM tastings WHERE event_pour_id=? AND member_id=? AND id<>?').get(result.event_pour_id,result.member_id,input.id??-1);
      if (duplicate) throw new Error('This member already rated this pour. Edit their existing tasting.');
      for (const key of ['whiskey_name','distillery','release','proof','bottle_id']) result[key]=pour[key];
    }
    const flavors=input.flavors??{};
    if (!flavors||typeof flavors!=='object'||Array.isArray(flavors)) throw new Error('Invalid flavor scores.');
    const clean={};
    for (const [stage,values] of Object.entries(flavors)) {
      if (!Object.hasOwn(tastingStages,stage)||!values||typeof values!=='object'||Array.isArray(values)) throw new Error('Invalid tasting stage.');
      clean[stage]={};
      for (const [descriptor,value] of Object.entries(values)) {
        if (!tastingStages[stage].includes(descriptor)||typeof value!=='number'||!Number.isInteger(value)||value<0||value>5) throw new Error('Flavor intensity must be an integer from 0 to 5.');
        clean[stage][descriptor]=value;
      }
    }
    result.flavors=JSON.stringify(clean);
    return result;
  }
  return {
    all:()=>db.prepare('SELECT * FROM tastings ORDER BY tasted_on DESC, id DESC').all().map(t=>({...t,flavors:JSON.parse(t.flavors)})),
    save:(input,id=null)=>{
      const row=validate({...input,id:id??-1}),keys=Object.keys(row),values=keys.map(k=>row[k]);
      if (id!==null) {
        if (!db.prepare(`UPDATE tastings SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...values,id).changes) return null;
        return {id};
      }
      return {id:Number(db.prepare(`INSERT INTO tastings (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...values).lastInsertRowid)};
    },
    remove:id=>Boolean(db.prepare('DELETE FROM tastings WHERE id=?').run(id).changes)
  };
}
