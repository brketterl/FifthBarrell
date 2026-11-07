(() => {
 const $=s=>document.querySelector(s),panel=$('#scan-panel'),dialog=$('#bottle-dialog'),form=$('#bottle-form');
 let version=0,worker=null,request=null;
 const libraries=new Map();
 function library(src){if(!libraries.has(src))libraries.set(src,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{libraries.delete(src);script.remove();reject(Error('Label reader could not load. Enter the bottle manually or try again.'));};document.head.append(script);}));return libraries.get(src);}
 function status(text){$('#scan-status').textContent=text;}
 function cancel(){version++;request?.abort();request=null;if(worker){worker.terminate();worker=null;}}
 function reset(){cancel();panel.hidden=true;$('#scan-results').replaceChildren();$('#label-review').hidden=true;$('#label-photo').value='';status('');}
 function begin(){cancel();$('#scan-results').replaceChildren();return version;}
 const active=v=>v===version&&dialog.open&&!panel.hidden;
 async function post(path,data,v){request=new AbortController();const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:request.signal});const result=await response.json();if(!response.ok)throw Error(result.error||'Lookup failed. Try catalog search or manual entry.');if(!active(v))return null;return result;}
 function choice(title,subtitle,action){const button=document.createElement('button');button.type='button';button.className='lookup-result';const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=subtitle;button.append(strong,small);button.onclick=action;$('#scan-results').append(button);}
 function apply(details){form.dispatchEvent(new CustomEvent('scan-details',{detail:details}));reset();form.elements.name.focus();}
 $('#open-scan').onclick=()=>{reset();panel.hidden=false;$('#label-photo').focus();};
 $('#close-scan').onclick=reset;
 form.addEventListener('scanner-reset',reset);dialog.addEventListener('close',reset);window.addEventListener('pagehide',reset);
 function validPhoto(file){if(!file||!file.type.startsWith('image/'))throw Error('Choose an image of the bottle.');if(file.size>15*1024*1024)throw Error('Choose a photo smaller than 15 MB.');}
 async function imageCanvas(file){const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas;}finally{URL.revokeObjectURL(url);}}
 async function labelMatches(v){status('Finding possible catalog matches…');const result=await post('catalog/label',{text:$('#label-text').value},v);if(!result)return;$('#scan-results').replaceChildren();status(result.results.length?'Possible matches — check the exact expression, proof, and release before selecting.':'No close catalog match. Correct the bottle name below, then use the label details or enter manually.');for(const b of result.results)choice(b.name,[b.distillery,b.proof==null?'Proof unknown':b.proof+' proof',b.release,b.source,'Use this suggestion →'].filter(Boolean).join(' · '),()=>apply({...b,catalog_id:b.id}));}
 $('#label-photo').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;const v=begin();$('#label-review').hidden=true;status('Loading label reader on your device…');let ownWorker;
  try{validPhoto(file);await library('/vendor/tesseract.js');if(!active(v))return;const canvas=await imageCanvas(file);if(!active(v))return;
   ownWorker=await Tesseract.createWorker('eng',1,{workerPath:'/vendor/worker.min.js',corePath:'/vendor/core',langPath:'/vendor/lang',workerBlobURL:false,logger:message=>{if(active(v)&&message.status==='recognizing text')status('Reading label on your device… '+Math.round(message.progress*100)+'%');}});
   if(!active(v)){await ownWorker.terminate();return;}worker=ownWorker;
   const result=await ownWorker.recognize(canvas);if(!active(v))return;
   const text=result.data.text.trim().slice(0,4000);$('#label-text').value=text;$('#label-name').value=text.split('\n').map(s=>s.trim()).find(s=>s.length>2)?.slice(0,250)||'';$('#label-review').hidden=false;
   if(!text){status('No label text was found. Try a clear, straight-on photo without glare, or enter the bottle manually.');return;}
   await labelMatches(v);
  }catch(e){if(active(v))status(e.message?.startsWith('Choose')?e.message:'Could not read this label. Try a clear JPG/PNG photo, catalog search, or manual entry.');}
  finally{if(ownWorker&&worker===ownWorker){worker=null;await ownWorker.terminate();}e.target.value='';}
 };
 $('#search-label').onclick=async()=>{const v=begin();try{await labelMatches(v);}catch(e){if(active(v))status(e.message);}};
 $('#use-label').onclick=()=>{const name=$('#label-name').value.trim();if(!name){status('Enter the bottle name to use these details.');$('#label-name').focus();return;}const match=$('#label-text').value.match(/\b(\d{2,3}(?:\.\d+)?)\s*proof\b/i);const proof=match&&Number(match[1])<=200?Number(match[1]):null;apply({name,proof});};
})();
