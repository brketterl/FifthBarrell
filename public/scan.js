(() => {
 const $=s=>document.querySelector(s),panel=$('#scan-panel'),dialog=$('#bottle-dialog'),form=$('#bottle-form');
 let version=0,controls=null,worker=null,request=null,runningCamera=false;
 const libraries=new Map();
 function library(src){if(!libraries.has(src))libraries.set(src,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>{libraries.delete(src);script.remove();reject(Error('Scanner could not load. Enter the bottle manually or try again.'));};document.head.append(script);}));return libraries.get(src);}
 function status(text){$('#scan-status').textContent=text;}
 function stopCamera(){runningCamera=false;controls?.stop();controls=null;const video=$('#scan-video');video.srcObject?.getTracks().forEach(track=>track.stop());video.srcObject=null;video.hidden=true;$('#stop-camera').hidden=true;}
 function reset(){version++;stopCamera();request?.abort();request=null;if(worker){worker.terminate();worker=null;}panel.hidden=true;$('#scan-results').replaceChildren();$('#label-review').hidden=true;$('#scan-code').value='';$('#barcode-photo').value='';$('#label-photo').value='';status('');}
 function begin(){version++;stopCamera();request?.abort();request=null;if(worker){worker.terminate();worker=null;}$('#scan-results').replaceChildren();return version;}
 const active=v=>v===version&&dialog.open&&!panel.hidden;
 async function post(path,data,v){request=new AbortController();const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:request.signal});const result=await response.json();if(!response.ok)throw Error(result.error||'Lookup failed. Try catalog search or manual entry.');if(!active(v))return null;return result;}
 function choice(title,subtitle,action){const button=document.createElement('button');button.type='button';button.className='lookup-result';const strong=document.createElement('strong');strong.textContent=title;const small=document.createElement('small');small.textContent=subtitle;button.append(strong,small);button.onclick=action;$('#scan-results').append(button);}
 function apply(details){form.dispatchEvent(new CustomEvent('scan-details',{detail:details}));reset();form.elements.name.focus();}
 async function lookup(code){const v=begin();$('#label-review').hidden=true;status('Looking up barcode…');try{const result=await post('barcode',{barcode:code},v);if(!result)return;$('#scan-code').value=result.barcode;status(result.items.length?'Review the match, then select it to fill the bottle name. Confirm proof and batch from your label.':'No match found. Try a label photo, catalog search, or enter the bottle manually.');for(const item of result.items)choice(item.title,[item.brand,result.source,'Use this suggestion →'].filter(Boolean).join(' · '),()=>apply({name:item.title,barcode:result.barcode}));if(!result.items.length)choice('Keep barcode and enter bottle details','Use the bottle form without a product match →',()=>apply({barcode:result.barcode,keepIdentity:true}));}catch(e){if(active(v)&&e.name!=='AbortError')status(e.message);}}
 $('#open-scan').onclick=()=>{reset();panel.hidden=false;$('#start-camera').focus();};
 $('#close-scan').onclick=reset;$('#stop-camera').onclick=()=>{version++;stopCamera();status('Camera stopped. You can enter the barcode below.');};
 form.addEventListener('scanner-reset',reset);dialog.addEventListener('close',reset);window.addEventListener('pagehide',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden){version++;stopCamera();}});
 $('#lookup-barcode').onclick=()=>lookup($('#scan-code').value);
 $('#scan-code').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookup(e.target.value);}});
 $('#start-camera').onclick=async()=>{
  const v=begin();$('#label-review').hidden=true;status('Allow camera access and hold the barcode steady in good light.');
  if(!navigator.mediaDevices?.getUserMedia){status('Camera scanning is unavailable here. Photograph the barcode or enter its number below.');return;}
  try{await library('/vendor/zxing.js');if(!active(v))return;
   const reader=new ZXingBrowser.BrowserMultiFormatReader();$('#scan-video').hidden=false;$('#stop-camera').hidden=false;runningCamera=true;
   const started=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}},$('#scan-video'),(result,error,scanner)=>{if(result&&active(v)&&runningCamera){scanner.stop();try{lookup(decoded(result));}catch(e){stopCamera();status(e.message);}}});
   if(!active(v)||!runningCamera)started.stop();else controls=started;
  }catch(e){if(active(v)){stopCamera();status(e.name==='NotAllowedError'?'Camera permission was denied. Use a photo or type the barcode below.':e.name==='NotFoundError'?'No camera was found. Use a photo or type the barcode below.':'Camera could not start. Close other camera apps, use a photo, or enter the barcode.');}}
 };
 function decoded(result){const f=ZXingBrowser.BarcodeFormat;if(![f.UPC_A,f.EAN_8,f.EAN_13,f.ITF].includes(result.getBarcodeFormat()))throw Error('Scan the product UPC/EAN barcode, rather than a QR code or other label code.');return result.getText();}
 function validPhoto(file){if(!file||!file.type.startsWith('image/'))throw Error('Choose an image of the bottle.');if(file.size>15*1024*1024)throw Error('Choose a photo smaller than 15 MB.');}
 $('#barcode-photo').onchange=async e=>{const file=e.target.files[0];if(!file)return;const v=begin();$('#label-review').hidden=true;status('Reading barcode photo…');let url;try{validPhoto(file);await library('/vendor/zxing.js');if(!active(v))return;url=URL.createObjectURL(file);const result=await new ZXingBrowser.BrowserMultiFormatReader().decodeFromImageUrl(url);if(active(v))lookup(decoded(result));}catch(e){if(active(v))status(e.message?.startsWith('Choose')?e.message:'No barcode could be read. Try a sharper close-up, a label photo, or type the digits.');}finally{if(url)URL.revokeObjectURL(url);e.target.value='';}};
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
