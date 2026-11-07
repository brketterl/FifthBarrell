(() => {
 const $=s=>document.querySelector(s),form=$('#bottle-form'),dialog=$('#bottle-dialog'),file=$('#ai-label-photo');let version=0,request=null,rows=[];
 const fields={name:{label:'Bottle name'},distillery:{label:'Distillery'},label:{label:'Label / edition'},expression:{label:'Expression'},proof:{label:'Proof',type:'number',min:0,max:200,step:0.1},age_years:{label:'Age (years)',type:'number',min:0,max:200,step:0.5},size_ml:{label:'Bottle size (mL)',type:'number',min:1,max:100000,step:1},release:{label:'Batch / release'},year:{label:'Bottling / release year',type:'number',min:1700,max:2200,step:1},bourbon_notes:{label:'Bourbon / tasting notes',multiline:true,maxLength:3000}};
 const active=v=>version===v&&dialog.open&&!$('#scan-panel').hidden;
 function status(text){$('#ai-label-status').textContent=text;}
 function reset(){version++;request?.abort();request=null;file.value='';file.disabled=false;$('#read-label-ai').disabled=false;rows=[];$('#ai-label-review').hidden=true;$('#ai-label-fields').replaceChildren();$('#ai-label-warnings').replaceChildren();status('');}
 async function availability(){const v=version;try{const response=await fetch('/api/label-recognition/status',{cache:'no-store'});const data=await response.json();if(v!==version)return;if(!response.ok)throw Error();$('#ai-label-availability').textContent=data.available?'OpenAI is configured. Choose label photos to read; API usage is billed to the society’s OpenAI account.':'The server cannot find an OpenAI API key. In the Render testing service, set OPENAI_API_KEY as an Environment variable or Secret File, then save/redeploy. You can still use the on-device reader below.';}catch{if(v===version)$('#ai-label-availability').textContent='Could not check AI availability. Select Check AI setup to retry. If your session expired, sign in again.';}}
 $('#read-label-ai').onclick=()=>{file.value='';file.click();};
 $('#check-ai-status').onclick=()=>{availability();};
 $('#open-scan').addEventListener('click',()=>{reset();availability();});$('#close-scan').addEventListener('click',reset);form.addEventListener('scanner-reset',reset);dialog.addEventListener('close',reset);window.addEventListener('pagehide',reset);
 async function encode(file){if(!file.type.startsWith('image/')||file.size>15*1024*1024)throw Error('Choose label photos smaller than 15 MB each.');const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',0.9);if(data.length>4*1024*1024)throw Error('This photo is too large. Try a closer crop of the label.');return data;}finally{URL.revokeObjectURL(url);}}
 function review(result){
  $('#ai-label-fields').replaceChildren();$('#ai-label-warnings').replaceChildren();rows=[];
  for(const warning of result.warnings){const p=document.createElement('p');p.textContent=warning;$('#ai-label-warnings').append(p);}
  if(!result.readable){status('The label could not be read clearly. Try sharper front/back photos or use the on-device reader.');return;}
  for(const [key,spec] of Object.entries(fields)){
   const value=result.fields[key],has=value?.value!==null&&value?.value!==undefined;
   const box=document.createElement('div');box.className='ai-label-field';const toggle=document.createElement('label');toggle.className='ai-label-toggle';const check=document.createElement('input');check.type='checkbox';check.checked=has&&value.source!=='suggested'&&(!spec.multiline||!form.elements.bourbon_notes.value.trim());check.setAttribute('aria-label','Use '+spec.label);toggle.append(check,document.createTextNode(spec.label));
   const input=document.createElement(spec.multiline?'textarea':'input');if(!spec.multiline)input.type=spec.type||'text';else{input.rows=6;box.classList.add('ai-label-notes');}input.value=has?String(value.value):'';input.placeholder=has?'':'Not visible on label';input.setAttribute('aria-label','AI '+spec.label);input.dataset.aiField=key;if(spec.type){input.min=spec.min;input.max=spec.max;input.step=spec.step;}else input.maxLength=spec.maxLength||250;
   const evidence=document.createElement('small');evidence.textContent=has?(value.source==='suggested'?'AI-suggested profile, not verified for this bottle or batch. Select the checkbox to include it.':(spec.multiline?'Tasting notes printed on the label: ':'Read from label: ')+value.evidence):'No supported value was found.';input.addEventListener('input',()=>{check.checked=Boolean(input.value.trim());});box.append(toggle,input,evidence);$('#ai-label-fields').append(box);rows.push({key,spec,input,check});
  }
  $('#ai-label-review').hidden=false;status('Bottle details are ready to review. Nothing has changed in your bottle form yet.');
 }
 file.onchange=async()=>{
  const chosen=[...file.files];if(!chosen.length)return;reset();const v=version;if(chosen.length>2){status('Choose no more than two label photos from the same bottle.');return;}
  status('Reading bottle details with OpenAI…');file.disabled=true;$('#read-label-ai').disabled=true;
  try{const images=[];for(const image of chosen){images.push(await encode(image));if(!active(v))return;}
   request=new AbortController();const response=await fetch('/api/label-recognition',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images}),signal:request.signal});const result=await response.json();if(!active(v))return;if(!response.ok)throw Error(result.error||'AI reading failed. Try the on-device reader.');review(result);
  }catch(e){if(active(v)&&e.name!=='AbortError')status(e.message||'Could not read this photo. Try a JPG or PNG.');}
  finally{if(v===version){file.disabled=false;$('#read-label-ai').disabled=false;file.value='';}}
 };
 $('#use-ai-label').onclick=()=>{
  const details={merge:true};let count=0;
  for(const row of rows){if(!row.check.checked)continue;if(!row.input.value.trim())continue;if(!row.input.checkValidity()){row.input.reportValidity();return;}details[row.key]=row.spec.type?Number(row.input.value):row.input.value.trim();count++;}
  if(!count){status('Select at least one detail to use.');return;}
  form.dispatchEvent(new CustomEvent('scan-details',{detail:details}));reset();$('#close-scan').click();form.elements.name.focus();
 };
})();
