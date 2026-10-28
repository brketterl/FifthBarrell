const $ = s => document.querySelector(s);
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
let state={members:[],bottles:[],events:[],pours:[],tastings:[],tastingStages:{}}, editing=null, lookupVersion=0, toastTimer;
async function api(path, method='GET', data) {
  const response=await fetch('/api/'+path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
  const result=await response.json(); if (!response.ok) throw new Error(result.error||'Something went wrong.'); return result;
}
function toast(message) { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,5000); }
const initials = name => name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
const owner = id => state.members.find(m=>m.id===id)?.name || 'Unknown member';
function art(b) {
  const colors=['#9e6128','#79512d','#a46b25','#86603b']; const color=colors[b.id%colors.length];
  return `<svg viewBox="0 0 110 170" aria-hidden="true"><ellipse cx="55" cy="161" rx="33" ry="5" fill="#55442c" opacity=".12"/><rect x="43" y="8" width="24" height="17" rx="3" fill="#28382e"/><path d="M44 25h22v32c0 9 19 11 19 25v68c0 7-5 10-12 10H37c-7 0-12-3-12-10V82c0-14 19-16 19-25Z" fill="${color}" stroke="#6c4c2b" stroke-width="1.5"/><path d="M32 87v60c0 4 2 6 6 6" fill="none" stroke="#fff" opacity=".21" stroke-width="4"/><rect x="31" y="84" width="48" height="51" rx="2" fill="#ede6ce"/><path d="M36 90h38v39H36z" fill="none" stroke="#b59862"/><text x="55" y="109" font-family="Georgia" font-size="16" text-anchor="middle" fill="#344233">V</text><text x="55" y="120" font-family="Arial" font-size="4.5" letter-spacing=".6" text-anchor="middle" fill="#736443">FIFTH BARREL</text><rect x="44" y="30" width="21" height="5" fill="#c4a769"/></svg>`;
}
function meter(n) { return `<svg width="100%" height="4" role="img" aria-label="${n}% remaining" preserveAspectRatio="none" viewBox="0 0 100 4"><rect width="100" height="4" rx="2" fill="#edeee6"/><rect width="${n}" height="4" rx="2" fill="#9baf8f"/></svg>`; }
function render() {
  const memberValue=$('#member-filter').value;
  $('#member-filter').innerHTML='<option value="">All members</option>'+state.members.map(m=>`<option value="${m.id}">${escape(m.name)}’s cabinet</option>`).join('');
  $('#member-filter').value=state.members.some(m=>String(m.id)===memberValue)?memberValue:'';
  const member=$('#member-filter').value, rating=$('#rating-filter').value,q=$('#search').value.toLowerCase();
  const collection=state.bottles.filter(b=>!member||String(b.member_id)===member);
  const bottles=collection.filter(b=>(!rating||b.rating===rating)&&(`${b.name} ${b.distillery}`.toLowerCase().includes(q)));
  const sort=$('#sort').value;
  bottles.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='price'?(b.price??-1)-(a.price??-1):sort==='remaining'?a.remaining-b.remaining:b.id-a.id);
  $('#stat-bottles').textContent=collection.length;
  $('#stat-value').textContent=money(collection.reduce((sum,b)=>sum+(b.price??0),0));
  $('#stat-favorites').textContent=collection.filter(b=>b.rating==='Favorite').length;
  $('#stat-members').textContent=state.members.length;
  $('#collection-heading').textContent=member?`${owner(Number(member))}’s cabinet`:'The society’s collection';
  $('#collection-count').textContent=`${bottles.length} bottle${bottles.length===1?'':'s'}`;
  $('#bottles').innerHTML=bottles.map(b=>`<article class="bottle-card" tabindex="0" role="button" aria-label="View ${escape(b.name)}" data-bottle="${b.id}"><div class="bottle-art"><span class="badge">${b.rating==='Favorite'?'☆ ':''}${escape(b.rating)}</span>${art(b)}</div><div class="card-body"><div class="distillery">${escape(b.distillery||'Distillery not specified')}</div><h3>${escape(b.name)}</h3>${b.label?'<p class="bottle-meta">Label: '+escape(b.label)+(b.expression?' · '+escape(b.expression):'')+'</p>':''}<div class="bottle-meta">${b.proof==null?'Proof not recorded':b.proof+' PROOF'} &nbsp;·&nbsp; ${b.year||'Year not recorded'}${b.release?' · '+escape(b.release):''}</div><div class="card-rule"></div><div class="card-owner"><span><span class="avatar">${escape(initials(owner(b.member_id)))}</span>${escape(owner(b.member_id))}</span><span>${b.price==null?'—':money(b.price)}</span></div><div class="remaining-line"><span>LEFT IN THE BOTTLE</span><span>${b.remaining}%</span></div>${meter(b.remaining)}</div></article>`).join('');
  $('#empty').hidden=bottles.length>0;
  $('#empty h2').textContent=state.bottles.length?'No bottles on this shelf.':'A good collection starts with one bottle.';
  $('#empty p').textContent=state.bottles.length?'Try a different member, preference, or search.':'Add your members, then give your first bottle a place on the shelf.';
  $('#empty-add').hidden=state.bottles.length>0;
  $('#members').innerHTML=state.members.length?state.members.map(m=>{
    const bottles=state.bottles.filter(b=>b.member_id===m.id);
    return `<article class="member-card"><span class="avatar">${escape(initials(m.name))}</span><h3>${escape(m.name)}</h3><p>${bottles.length} bottles · ${money(bottles.reduce((s,b)=>s+(b.price??0),0))}<br>${bottles.filter(b=>b.rating==='Favorite').length} favorites</p><div class="member-actions"><button class="secondary" data-cabinet="${m.id}">View cabinet</button><button class="danger" data-remove-member="${m.id}">Remove member</button></div></article>`;
  }).join(''):'<div class="empty"><h2>There’s a seat at the table.</h2><p>Add your first society member to start collecting.</p></div>';
}
async function refresh() { state=await api('state'); render(); renderEvents(); }
function view(members) { $('#events-view').hidden=true; $('#events-nav').classList.remove('active'); $('#cabinet-view').hidden=members; $('#members-view').hidden=!members; $('#members-nav').classList.toggle('active',members); $('#cabinet-nav').classList.toggle('active',!members); }
$('#cabinet-nav').onclick=()=>view(false); $('#members-nav').onclick=()=>view(true);
for (const id of ['search','member-filter','rating-filter','sort']) $('#'+id).addEventListener(id==='search'?'input':'change',render);
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
function memberDialog() { $('#member-form').reset(); $('#member-error').textContent=''; $('#member-dialog').showModal(); }
$('#add-member').onclick=memberDialog;
function bottleDialog(b=null) {
  if (!state.members.length) { toast('Add a member first, then add their bottle.'); view(true); memberDialog(); return; }
  editing=b?.id??null; const form=$('#bottle-form'); form.reset();
  form.elements.member_id.innerHTML=state.members.map(m=>`<option value="${m.id}">${escape(m.name)}</option>`).join('');
  if (b) for (const key of ['name','member_id','distillery','proof','year','rating','remaining','price','bourbon_notes','member_notes','catalog_id','age_years','size_ml','release','label','expression']) form.elements[key].value=b[key]??'';
  else if ($('#member-filter').value) form.elements.member_id.value=$('#member-filter').value;
  $('#bottle-title').textContent=b?'Edit bottle':'Add a bottle'; $('#remaining-output').value=form.elements.remaining.value+'%';
  bottleLookup.reset(); $('#bottle-error').textContent=''; $('#bottle-dialog').showModal();
}
$('#add-bottle').onclick=()=>bottleDialog(); $('#empty-add').onclick=()=>bottleDialog();
$('#bottle-form').elements.remaining.oninput=e=>$('#remaining-output').value=e.target.value+'%';
async function submit(form,button,error,action) {
  button.disabled=true; error.textContent='';
  try { await action(); await refresh(); form.closest('dialog').close(); } catch(e) { error.textContent=e.message; } finally { button.disabled=false; }
}
$('#member-form').onsubmit=async e=>{
  e.preventDefault(); const form=e.target;
  await submit(form,form.querySelector('[type=submit]'),$('#member-error'),async()=>{ await api('members','POST',{name:form.elements.name.value}); toast('Member added to the society.'); });
};
$('#bottle-form').onsubmit=async e=>{
  e.preventDefault(); const form=e.target;
  await submit(form,form.querySelector('[type=submit]'),$('#bottle-error'),async()=>{ await api(editing?'bottles/'+editing:'bottles',editing?'PUT':'POST',Object.fromEntries(new FormData(form))); toast(editing?'Bottle updated.':'Bottle added to the cabinet.'); });
};

function detail(id) {
  const b=state.bottles.find(b=>b.id===id); if(!b)return;
  $('#detail').innerHTML=`<div class="dialog-header"><div><div class="eyebrow">${escape(b.distillery||'THE COLLECTION')}</div><h2>${escape(b.name)}</h2></div><button class="icon-button" id="close-detail" aria-label="Close">×</button></div><div class="bottle-art detail-art"><span class="badge">${escape(b.rating)}</span>${art(b)}</div><div class="details-grid"><div><small>Member</small><strong>${escape(owner(b.member_id))}</strong></div><div><small>Label name</small><strong>${escape(b.label||'Not recorded')}</strong></div><div><small>Expression</small><strong>${escape(b.expression||'Not recorded')}</strong></div><div><small>Batch / release</small><strong>${escape(b.release||'—')}</strong></div><div><small>Proof</small><strong>${b.proof??'—'}</strong></div><div><small>Age statement</small><strong>${b.age_years==null?'—':b.age_years+' years'}</strong></div><div><small>Bottle size</small><strong>${b.size_ml==null?'—':b.size_ml+' mL'}</strong></div><div><small>Release year</small><strong>${b.year??'—'}</strong></div><div><small>Purchase price</small><strong>${b.price==null?'—':money(b.price)}</strong></div><div><small>Amount left</small><strong>${b.remaining}%</strong></div></div>${meter(b.remaining)}<div class="notes"><h3>Bourbon / tasting notes</h3><p>${escape(b.bourbon_notes||'No tasting notes yet.')}</p></div><div class="notes"><h3>Member notes</h3><p>${escape(b.member_notes||'No member notes yet.')}</p></div><div class="detail-actions"><button class="danger" id="delete-bottle">Remove bottle</button><button class="primary" id="edit-bottle">Edit bottle</button></div>`;
  $('#close-detail').onclick=()=>$('#detail-dialog').close();
  $('#edit-bottle').onclick=()=>{ $('#detail-dialog').close(); bottleDialog(b); };
  $('#delete-bottle').onclick=async()=>{
    if(!confirm(`Remove “${b.name}” from ${owner(b.member_id)}’s cabinet? This cannot be undone.`))return;
    try { await api('bottles/'+id,'DELETE'); await refresh(); $('#detail-dialog').close(); toast('Bottle removed.'); } catch(e){toast(e.message);}
  };
  $('#detail-dialog').showModal();
}
$('#bottles').onclick=e=>{ const card=e.target.closest('[data-bottle]'); if(card)detail(Number(card.dataset.bottle)); };
$('#bottles').onkeydown=e=>{ if(['Enter',' '].includes(e.key)){ const card=e.target.closest('[data-bottle]'); if(card){e.preventDefault();detail(Number(card.dataset.bottle));} } };
$('#members').onclick=async e=>{
  const cabinet=e.target.closest('[data-cabinet]'); if(cabinet){$('#member-filter').value=cabinet.dataset.cabinet;view(false);render();return;}
  const remove=e.target.closest('[data-remove-member]'); if(!remove)return;
  const id=Number(remove.dataset.removeMember),count=state.bottles.filter(b=>b.member_id===id).length;
  const tastingCount=state.tastings.filter(t=>t.member_id===id).length;
  if(!confirm(`Remove ${owner(id)} and permanently delete their ${count} bottle${count===1?'':'s'} and ${tastingCount} tasting record${tastingCount===1?'':'s'}? This cannot be undone.`))return;
  try { await api('members/'+id,'DELETE'); await refresh(); toast('Member removed.'); } catch(e){toast(e.message);}
};
let selectedEventId='', tastingContext=null, pouringEventId=null, revealingPourId=null;
const stageHelp={nose:'Pause before sipping. What aromas do you notice?',palate:'Take a small sip. Explore sweetness, fruit, wood, and spice.',finish:'After the sip, notice what lingers and for how long.',mouthfeel:'Notice texture and weight. Body: 0 = thin, 5 = full. Other descriptors: 0 = absent, 5 = very strong.'};
const stageName=s=>s[0].toUpperCase()+s.slice(1);
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
$('#events-nav').onclick=()=>{
  $('#cabinet-view').hidden=true;$('#members-view').hidden=true;$('#events-view').hidden=false;
  for(const id of ['cabinet-nav','members-nav']) $('#'+id).classList.remove('active');
  $('#events-nav').classList.add('active');
};
function renderEvents() {
  if (!state.events.some(e=>String(e.id)===selectedEventId)) selectedEventId=String(state.events[0]?.id??'');
  $('#event-select').innerHTML=state.events.length?state.events.map(e=>`<option value="${e.id}">${escape(e.name)} · ${escape(e.event_date)}</option>`).join(''):'<option value="">No events yet</option>';
  $('#event-select').value=selectedEventId;
  const selected=state.events.find(e=>String(e.id)===selectedEventId);
  if(!selected) $('#event-content').innerHTML='<div class="empty"><div class="empty-icon">◇</div><h2>Set the table for your first flight.</h2><p>Create an event, add the pours, then invite members to record their impressions here.</p></div>';
  else {
    const pours=state.pours.filter(p=>p.event_id===selected.id), tastings=state.tastings.filter(t=>pours.some(p=>p.id===t.event_pour_id));
    $('#event-content').innerHTML=`<div class="event-banner"><div><div class="eyebrow">${selected.blind_mode?'BLIND TASTING EVENT':'SOCIETY TASTING EVENT'} · ${escape(selected.event_date)}</div><h2>${escape(selected.name)}</h2><p>${escape(selected.location||'Location not specified')} · ${pours.length} pours · ${new Set(tastings.map(t=>t.member_id)).size} members tasted</p></div><div class="member-actions"><button class="primary" id="add-pour">＋ Add a pour</button><button class="danger" id="remove-event">Remove event</button></div></div><div class="flight-grid">${pours.map((p,i)=>{
      const notes=tastings.filter(t=>t.event_pour_id===p.id),average=notes.length?(notes.reduce((sum,t)=>sum+t.score,0)/notes.length).toFixed(1):'—';
      return `<article class="flight-card"><span class="eyebrow">POUR ${i+1}</span><h3>${escape(p.whiskey_name)}</h3>${p.blind_label?'<p class="help">'+escape(p.blind_label)+(p.revealed?' · Revealed':' · Identity not entered')+'</p>':''}${p.label?'<p class="help">Label: '+escape(p.label)+(p.expression?' · '+escape(p.expression):'')+'</p>':''}<p class="help">${escape(p.distillery||'Distillery not recorded')}<br>${p.proof==null?'Proof not recorded':p.proof+' proof'}${p.release?' · '+escape(p.release):''}</p><div class="flight-score"><strong>${average}</strong><span>${notes.length?' / 10 · '+notes.length+' tasting'+(notes.length===1?'':'s'):'No tastings yet'}</span></div><div class="member-actions"><button class="primary" data-taste-pour="${p.id}">Taste this pour</button>${selected.blind_mode&&!p.revealed?'<button class="secondary" data-reveal-pour="'+p.id+'">Enter bourbon & reveal</button>':''}<button class="danger" data-remove-pour="${p.id}">Remove pour</button></div></article>`;
    }).join('')||'<div class="empty"><h2>Choose your lineup.</h2><p>Add a pour from the cabinet or enter a whiskey manually.</p></div>'}</div>${pours.length?comparison(pours,tastings):''}`;
    $('#add-pour').onclick=()=>showPourForm(selected);
    $('#remove-event').onclick=async()=>{
      if(!confirm(`Remove “${selected.name}” and its flight? Tasting records will remain in the journal without the event link.`))return;
      try{await api('events/'+selected.id,'DELETE');await refresh();toast('Event removed; tasting history preserved.');}catch(e){toast(e.message);}
    };
  }
  const filter=$('#taster-filter').value;
  $('#taster-filter').innerHTML='<option value="">All members’ tastings</option>'+state.members.map(m=>`<option value="${m.id}">${escape(m.name)}</option>`).join('');
  $('#taster-filter').value=state.members.some(m=>String(m.id)===filter)?filter:'';
  const history=state.tastings.filter(t=>!$('#taster-filter').value||String(t.member_id)===$('#taster-filter').value);
  $('#tasting-history').innerHTML=history.length?history.map(t=>{
    const pour=state.pours.find(p=>p.id===t.event_pour_id),event=state.events.find(e=>e.id===pour?.event_id);
    return `<article class="member-card tasting-card"><div class="eyebrow">${escape(t.tasted_on)} · ${escape(owner(t.member_id))}</div><h3>${escape(t.whiskey_name)}</h3><div class="journal-score">${t.score}<small> / 10 enjoyment</small></div><p class="help">${escape(event?.name||'Independent / archived tasting')}${pour?.blind_label?' · '+escape(pour.blind_label)+(pour.revealed?' · Revealed':' · Blind'):''}${t.release?' · '+escape(t.release):''}<br>${escape(t.setting)}</p>${Object.entries(state.tastingStages).map(([stage])=>`<details><summary>${stageName(stage)}</summary><p>${escape(t[stage+'_notes']||'No written notes.')}</p><p class="help">${Object.entries(t.flavors[stage]??{}).map(([name,value])=>`${escape(name)}: ${value}/5`).join(' · ')||'No intensities assessed.'}</p></details>`).join('')}<p class="journal-notes">${escape(t.notes)}</p><div class="member-actions"><button class="secondary" data-edit-tasting="${t.id}">Edit tasting</button><button class="danger" data-remove-tasting="${t.id}">Remove tasting</button></div></article>`;
  }).join(''):'<div class="empty"><h2>The first impressions are yours.</h2><p>Record a tasting from a flight to start the journal.</p></div>';
}
function comparison(pours,tastings) {
  return `<div class="collection-title"><h2>Compare the flight</h2></div><p class="help">Enjoyment is 1–10; descriptor intensity is 0–5. Averages use assessed values only; “—” means not assessed. These are your members’ observations, not published whiskey profiles.</p><div class="comparison-scroll"><table class="comparison"><thead><tr><th scope="col">Member / descriptor</th>${pours.map(p=>`<th scope="col">${escape(p.whiskey_name)}</th>`).join('')}</tr></thead><tbody>${state.members.map(m=>{
    if(!tastings.some(t=>t.member_id===m.id))return '';
    return `<tr><th scope="row">${escape(m.name)} · enjoyment</th>${pours.map(p=>{const t=tastings.find(t=>t.member_id===m.id&&t.event_pour_id===p.id);return `<td>${t?t.score+'/10':'—'}</td>`;}).join('')}</tr>`;
  }).join('')}${Object.entries(state.tastingStages).map(([stage,names])=>names.filter(name=>tastings.some(t=>typeof t.flavors[stage]?.[name]==='number')).map(name=>`<tr><th scope="row">${stageName(stage)} · ${escape(name)}</th>${pours.map(p=>{
    const values=tastings.filter(t=>t.event_pour_id===p.id&&typeof t.flavors[stage]?.[name]==='number').map(t=>t.flavors[stage][name]);
    return `<td>${values.length?(values.reduce((s,n)=>s+n,0)/values.length).toFixed(1)+'/5 <small>(n='+values.length+')</small>':'—'}</td>`;
  }).join('')}</tr>`).join('')).join('')}</tbody></table></div>`;
}
$('#event-select').onchange=e=>{selectedEventId=e.target.value;renderEvents();};
$('#taster-filter').onchange=renderEvents;
$('#add-event').onclick=()=>{const f=$('#event-form');f.reset();f.elements.event_date.value=localDate();$('#event-error').textContent='';$('#event-dialog').showModal();};
$('#event-form').onsubmit=async e=>{
  e.preventDefault();const f=e.target;
  await submit(f,f.querySelector('[type=submit]'),$('#event-error'),async()=>{const result=await api('events','POST',Object.fromEntries(new FormData(f)));selectedEventId=String(result.id);toast('Event created. Add the first pour to your flight.');});
};
function showPourForm(event,reveal=null){
  pouringEventId=event.id;revealingPourId=reveal?.id??null;
  const f=$('#pour-form');f.reset();
  const blind=Boolean(event.blind_mode&&!reveal);
  f.elements.bottle_id.innerHTML='<option value="">Enter a whiskey manually</option>'+state.bottles.map(b=>`<option value="${b.id}">${escape(b.name)} · ${escape(owner(b.member_id))}</option>`).join('');
  pourLookup.reset();
  $('#pour-identity-lookup').hidden=blind;$('#pour-identity-fields').hidden=blind;
  $('#pour-title').textContent=reveal?'Reveal '+reveal.blind_label:blind?'Add an anonymous sample':'Add a pour to the flight';
  $('#pour-name-label').textContent=blind?'Sample name *':'Whiskey name *';
  f.querySelector('[type=submit]').textContent=reveal?'Reveal bourbon':blind?'Add sample':'Add pour';
  if(blind)f.elements.whiskey_name.value='Sample '+(state.pours.filter(p=>p.event_id===event.id).length+1);
  $('#pour-error').textContent='';$('#pour-dialog').showModal();
}
$('#pour-form').elements.bottle_id.onchange=e=>{
  const b=state.bottles.find(b=>String(b.id)===e.target.value),f=$('#pour-form');pourLookup.reset();f.elements.catalog_id.value=b?.catalog_id??'';
  for(const [key,value] of Object.entries({label:b?.label??'',expression:b?.expression??'',whiskey_name:b?.name??'',distillery:b?.distillery??'',release:b?.year??'',proof:b?.proof??''}))f.elements[key].value=value;
};
$('#pour-form').onsubmit=async e=>{
  e.preventDefault();const f=e.target;
  if(revealingPourId&&!confirm('Reveal this bourbon to everyone and attach its identity to the saved tasting records?'))return;
  await submit(f,f.querySelector('[type=submit]'),$('#pour-error'),async()=>{await api(revealingPourId?'pours/'+revealingPourId+'/reveal':'events/'+pouringEventId+'/pours',revealingPourId?'PUT':'POST',Object.fromEntries(new FormData(f)));toast(revealingPourId?'Bourbon revealed. Tasting scores and notes preserved.':'Pour added to the flight.');});
};
function taste(pour,existing=null) {
  if(!state.members.length){toast('Add society members before recording their tastings.');view(true);memberDialog();return;}
  tastingContext={pour,existing};const f=$('#tasting-form');f.reset();
  f.elements.member_id.innerHTML=state.members.map(m=>`<option value="${m.id}">${escape(m.name)}</option>`).join('');
  f.elements.tasted_on.value=existing?.tasted_on||state.events.find(e=>e.id===pour?.event_id)?.event_date||localDate();
  if(existing)for(const key of ['member_id','score','setting','notes'])f.elements[key].value=existing[key]??'';
  $('#tasting-title').textContent=existing?'Edit tasting':'Taste this pour';
  $('#tasting-whiskey').textContent=(pour||existing).whiskey_name;
  $('#guided-stages').innerHTML=Object.entries(state.tastingStages).map(([stage,names],i)=>`<fieldset class="tasting-stage"><legend>${i+1}. ${stageName(stage)}</legend><p class="help">${stageHelp[stage]}</p><div class="descriptor-grid">${names.map(name=>`<label>${escape(name)}<select data-stage="${stage}" data-descriptor="${escape(name)}"><option value="">Not assessed</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}"${existing?.flavors[stage]?.[name]===n?' selected':''}>${n}${n===0?' · Absent':n===5?' · Very strong':''}</option>`).join('')}</select></label>`).join('')}</div><label>Your ${stage} notes<textarea name="${stage}_notes" rows="2" maxlength="10000">${escape(existing?.[stage+'_notes']??'')}</textarea></label></fieldset>`).join('');
  $('#tasting-error').textContent='';$('#tasting-dialog').showModal();
}
$('#tasting-form').onsubmit=async e=>{
  e.preventDefault();const f=e.target,{pour,existing}=tastingContext,identity=pour||existing;
  const payload={...Object.fromEntries(new FormData(f)),whiskey_name:identity.whiskey_name,distillery:identity.distillery,release:identity.release,proof:identity.proof,bottle_id:identity.bottle_id,event_pour_id:pour?.id??null,flavors:{}};
  f.querySelectorAll('[data-descriptor]').forEach(select=>{if(select.value!==''){payload.flavors[select.dataset.stage]??={};payload.flavors[select.dataset.stage][select.dataset.descriptor]=Number(select.value);}});
  await submit(f,f.querySelector('[type=submit]'),$('#tasting-error'),async()=>{await api(existing?'tastings/'+existing.id:'tastings',existing?'PUT':'POST',payload);toast('Tasting saved. Your flight results have been updated.');});
};
$('#event-content').onclick=async e=>{
  const button=e.target.closest('[data-taste-pour]');if(button){taste(state.pours.find(p=>p.id===Number(button.dataset.tastePour)));return;}
  const reveal=e.target.closest('[data-reveal-pour]');if(reveal){const pour=state.pours.find(p=>p.id===Number(reveal.dataset.revealPour));showPourForm(state.events.find(event=>event.id===pour.event_id),pour);return;}
  const remove=e.target.closest('[data-remove-pour]');if(!remove||!confirm('Remove this pour from the flight? Its tasting history will remain in the journal.'))return;
  try{await api('pours/'+remove.dataset.removePour,'DELETE');await refresh();toast('Pour removed; tastings preserved.');}catch(e){toast(e.message);}
};
$('#tasting-history').onclick=async e=>{
  const edit=e.target.closest('[data-edit-tasting]');if(edit){const t=state.tastings.find(t=>t.id===Number(edit.dataset.editTasting));taste(state.pours.find(p=>p.id===t.event_pour_id)??null,t);return;}
  const remove=e.target.closest('[data-remove-tasting]');if(!remove||!confirm('Permanently remove this tasting?'))return;
  try{await api('tastings/'+remove.dataset.removeTasting,'DELETE');await refresh();toast('Tasting removed.');}catch(e){toast(e.message);}
};
$('#export-data').onclick=async()=>{
  try{const current=await api('state'),url=URL.createObjectURL(new Blob([JSON.stringify({application:'Fifth Barrel Society',version:1,exported_at:new Date().toISOString(),...current},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fifth-barrel-society-'+localDate()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){toast(e.message);}
};
function safeSourceLink(url,label) {
  try { const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new Error();return `<a href="${escape(u.href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`; } catch { return escape(label); }
}
function catalogLookup(inputSelector,resultsSelector,referenceSelector,fill) {
  const input=$(inputSelector),source=$(inputSelector+'-source'),results=$(resultsSelector),reference=$(referenceSelector);let version=0;
  function reset(){version++;input.value='';source.value='';results.replaceChildren();reference.hidden=true;reference.replaceChildren();}
  async function search(offset=0){
    const current=++version,q=input.value.trim();results.replaceChildren();if(q.length<2)return;
    try {
      const data=await api('catalog?q='+encodeURIComponent(q)+'&source='+encodeURIComponent(source.value)+'&offset='+offset);if(current!==version)return;
      results.innerHTML=`<p class="help">${safeSourceLink(data.url,data.source)} · ${data.matched} matches${data.matched>data.results.length?' · Results '+(data.offset+1)+'–'+(data.offset+data.results.length):''}</p>`+(data.results.length?data.results.map((b,i)=>`<button type="button" class="lookup-result" data-result="${i}">${escape(b.name)}<small>Label: ${escape(b.label||'Not recorded')}${b.expression?' · Expression: '+escape(b.expression):''}</small><small>${escape(b.source||data.source)}${b.release?' · '+escape(b.release):''}${b.release_year_text?' · '+escape(b.release_year_text):''}${b.selection?' · Pick: '+escape(b.selection):''}${b.barrel?' · Barrel '+escape(b.barrel):''}${b.warehouse?' · Warehouse '+escape(b.warehouse):''}${b.floor?' · Floor '+escape(b.floor):''}${b.rick?' · Rick '+escape(b.rick):''}</small><small>${escape(b.distillery||'Distillery not verified')}${b.supplier?' · Supplier: '+escape(b.supplier):''} · ${b.proof==null?'Proof unknown':escape(b.proof)+' proof'}</small></button>`).join(''):'<p class="help">No catalog match. Enter your bottle details manually.</p>');
      results.insertAdjacentHTML('beforeend',`<div class="member-actions">${data.offset>0?'<button type="button" class="secondary" data-page="'+Math.max(0,data.offset-25)+'">Previous results</button>':''}${data.next_offset!=null?'<button type="button" class="secondary" data-page="'+data.next_offset+'">Next results</button>':''}</div>`);
      results.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>search(Number(button.dataset.page)));
      results.querySelectorAll('[data-result]').forEach(button=>button.onclick=()=>{
        const b=data.results[Number(button.dataset.result)];fill(b);input.value=b.name;results.replaceChildren();reference.hidden=false;
        reference.innerHTML=`<strong>${escape(b.name)}</strong><p class="help">Brand: ${escape(b.brand||'Not recorded')}<br>Label: ${escape(b.label||'Not recorded')}<br>Expression: ${escape(b.expression||'Not recorded')}</p><p class="help">${safeSourceLink(b.url,b.source)}${b.license?' · '+safeSourceLink(b.license,'CC BY 4.0'):''}${b.last_verified?' · Source verification date: '+escape(b.last_verified):''}${b.release?' · '+escape(b.release):''}${b.release_year_text?' · '+escape(b.release_year_text):''}${b.selection?' · Pick: '+escape(b.selection):''}${b.barrel?' · Barrel '+escape(b.barrel):''}${b.warehouse?' · Warehouse '+escape(b.warehouse):''}${b.floor?' · Floor '+escape(b.floor):''}${b.rick?' · Rick '+escape(b.rick):''}<br>${b.age_years==null?'Age not stated':escape(b.age_years)+' years old'}${b.size_ml==null?'':' · '+escape(b.size_ml)+' mL'}${b.supplier?' · Supplier: '+escape(b.supplier):''}</p>${b.prices.length?'<details><summary>Dated retail reference prices</summary>'+b.prices.map(p=>`<p class="help">${escape(p.state||'Retail')} · ${money(p.amount_usd)} · ${escape(p.retrieved||'Date unknown')}<br>${safeSourceLink(p.url,p.source||'Price source')}${p.note?'<br>'+escape(p.note):''}</p>`).join('')+'</details>':''}${b.flags.length?'<details><summary>Source caveats</summary><ul>'+b.flags.map(flag=>'<li>'+escape(flag)+'</li>').join('')+'</ul></details>':''}<p class="help">${escape(data.note)}</p>`;
      });
    }catch(e){if(current===version)results.textContent='Lookup is unavailable. Enter the whiskey details manually.';}
  };
  input.oninput=()=>search();source.onchange=()=>search();
  return {reset};
}
const bottleLookup=catalogLookup('#lookup','#lookup-results','#catalog-reference',b=>{
  const f=$('#bottle-form');for(const [key,value] of Object.entries({name:b.name,distillery:b.distillery,proof:b.proof,catalog_id:b.id,age_years:b.age_years,size_ml:b.size_ml,label:b.label??'',expression:b.expression??''}))f.elements[key].value=value??'';
  if(b.release)f.elements.release.value=b.release;
  if(b.release_year&&!f.elements.year.value)f.elements.year.value=b.release_year;
  toast('Catalog details filled in. Confirm batch, proof and age against your label.');
});
const pourLookup=catalogLookup('#pour-lookup','#pour-lookup-results','#pour-catalog-reference',b=>{
  const f=$('#pour-form');f.elements.bottle_id.value='';for(const [key,value] of Object.entries({whiskey_name:b.name,distillery:b.distillery,proof:b.proof,catalog_id:b.id,label:b.label??'',expression:b.expression??''}))f.elements[key].value=value??'';
  if(b.release)f.elements.release.value=b.release;
  toast('Catalog whiskey selected. Confirm the batch and proof for this pour.');
});
refresh().catch(e=>{ $('#empty').hidden=false; $('#empty h2').textContent='The cabinet could not be loaded.'; $('#empty p').textContent='Please refresh to try again. '+e.message; $('#empty-add').hidden=true; });
