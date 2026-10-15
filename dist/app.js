import {createFeature,moveFeature,reorder,encode,decode,History,blankWorld,restoreWorld} from './model.js?v=draw-freely-7';
import {path,renderFeature,backdrop,esc} from './render.js?v=draw-freely-7';
import {MultiplayerManager} from './multiplayer.js';

const $=id=>document.getElementById(id),KEY='world-atlas-v1';
let state=blankWorld(),saveBlocked=false;
try{const raw=localStorage.getItem(KEY);state=await restoreWorld(raw);}catch{saveBlocked=true;}
const history=new History(state);let selected=null,editingPoints=false,tool='drawing',gesture=null,space=false,showLayers=false,toastTimer;
const svg=$('map'),view=$('viewport');let camera={x:0,y:0,k:1},baseScale=1;
const toolInfo=[['drawing','Draw','B'],['erase','Erase','E'],['select','Select','V'],['pan','Pan','H']];

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function save(){if(saveBlocked){$('save-status').textContent='Save paused';$('save-status').classList.add('error');return;}try{localStorage.setItem(KEY,encode(state));$('save-status').textContent='Saved';$('save-status').classList.remove('error');}catch{$('save-status').textContent='Couldn’t save';$('save-status').classList.add('error');}}
function commit(){history.push(state);save();updateHistory();renderLayers();}
function updateHistory(){$('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;}

// Setup Multiplayer P2P Sync
const mp = new MultiplayerManager({
  getState: () => state,
  showToast: toast,
  onSync: (remoteState) => {
    if (remoteState?.features) {
      state = remoteState;
      save();
      renderAll();
    }
  },
  onAdd: (feature) => {
    if (!state.features.some(f => f.id === feature.id)) {
      state.features.push(feature);
      save();
      renderMap();
      renderLayers();
    }
  },
  onUpdate: (feature) => {
    state.features = state.features.map(f => f.id === feature.id ? feature : f);
    save();
    renderMap();
    if (selected === feature.id) renderPanel();
  },
  onDelete: (featureId) => {
    state.features = state.features.filter(f => f.id !== featureId);
    if (selected === featureId) {
      selected = null;
      renderPanel();
    }
    save();
    renderMap();
    renderLayers();
  },
  onTitle: (title) => {
    state.title = title;
    $('world-title').value = title;
    save();
  }
});

function chooseTool(next){tool=next;document.querySelector('main').classList.toggle('editing',next==='select');if(next!=='select'){selected=null;editingPoints=false;renderPanel();}svg.dataset.tool=next;document.querySelectorAll('.tool').forEach(b=>{b.classList.toggle('active',b.dataset.tool===next);b.setAttribute('aria-pressed',b.dataset.tool===next)});renderMap();}
function renderMap(){$('features').innerHTML=state.features.map(f=>renderFeature(f,f.id===selected&&tool==='select')).join('');const f=state.features.find(f=>f.id===selected);$('handles').innerHTML=f?.visible&&tool==='select'&&editingPoints?f.points.map((p,i)=>`<circle class="vertex" data-vertex="${i}" cx="${p[0]}" cy="${p[1]}" r="${4/camera.k}"/>`).join(''):'';}
function select(id){selected=id;editingPoints=false;renderMap();renderPanel();renderLayers();}

function renderPanel(){const f=state.features.find(f=>f.id===selected);if(!f){$('feature-panel').innerHTML=`<p class="empty-copy">Select a feature to edit.</p>`;return;}
$('feature-panel').innerHTML=`<div class="feature-tag">${f.type==='settlement'?'Village':esc(f.type)}</div><label class="field">Name<input id="feature-name" type="text" maxlength="160" value="${esc(f.name)}" placeholder="Name"></label><label class="field">Lore<textarea id="feature-lore" maxlength="6000" placeholder="Description">${esc(f.lore)}</textarea></label><label class="field">Width<input id="feature-size" type="range" min="1" max="18" step="0.5" value="${f.size}"></label><div class="appearance"><label for="feature-color">Color</label><input id="feature-color" type="color" value="${f.color}"></div><label class="checkbox"><input id="feature-label" type="checkbox" ${f.label?'checked':''}>Show name on map</label><label class="checkbox"><input id="feature-visible" type="checkbox" ${f.visible?'checked':''}>Visible on map</label><button id="reshape" aria-pressed="${editingPoints}">Edit points</button><div class="stacking"><button id="send-back">Send back</button><button id="bring-front">Bring forward</button></div><button class="delete" id="delete-feature">Remove this ${f.type==='settlement'?'village':f.type}</button>`;
for(const [id,prop]of [['feature-name','name'],['feature-lore','lore'],['feature-size','size'],['feature-color','color'],['feature-label','label'],['feature-visible','visible']]){
  const input=$(id);
  input.addEventListener('input',()=>{
    const feature=state.features.find(o=>o.id===selected);
    if (!feature) return;
    feature[prop]=input.type==='checkbox'?input.checked:prop==='size'?Number(input.value):input.value;
    renderMap();
    save();
  });
  input.addEventListener('change',()=>{
    commit();
    const feature=state.features.find(o=>o.id===selected);
    if (feature) mp.broadcastUpdate(feature);
  });
}
$('reshape').onclick=()=>{editingPoints=!editingPoints;$('reshape').setAttribute('aria-pressed',editingPoints);renderMap();};
$('send-back').onclick=()=>{stack(f.id,-1);mp.broadcastUpdate(f);};
$('bring-front').onclick=()=>{stack(f.id,1);mp.broadcastUpdate(f);};
$('delete-feature').onclick=remove;
$('send-back').disabled=state.features[0]?.id===f.id;$('bring-front').disabled=state.features.at(-1)?.id===f.id;
}

function renderLayers(){$('layers').innerHTML=[...state.features].reverse().map((f,i)=>`<div class="layer-row ${selected===f.id?'selected':''}"><button class="eye" data-visibility="${esc(f.id)}" title="${f.visible?'Hide':'Show'} ${esc(f.name)}" aria-label="${f.visible?'Hide':'Show'} ${esc(f.name)}">${f.visible?'Hide':'Show'}</button><button class="layer-name" data-select="${esc(f.id)}">${esc(f.name||'Unnamed '+f.type)}</button><div class="layer-arrows"><button data-order="1" data-layer="${esc(f.id)}" aria-label="Bring ${esc(f.name)} forward" ${i===0?'disabled':''}>Up</button><button data-order="-1" data-layer="${esc(f.id)}" aria-label="Send ${esc(f.name)} back" ${i===state.features.length-1?'disabled':''}>Down</button></div></div>`).join('')||'<p class="layer-help">No features yet.</p>';}
function stack(id,d){state.features=reorder(state.features,id,d);commit();renderMap();renderPanel();}
function remove(){
  if(!selected)return;
  const toDelete = selected;
  state.features=state.features.filter(f=>f.id!==toDelete);
  selected=null;
  commit();
  renderMap();
  renderPanel();
  mp.broadcastDelete(toDelete);
}
function renderAll(){renderMap();renderPanel();renderLayers();$('world-title').value=state.title;updateHistory();}
function travel(dir){state=dir==='undo'?history.undo():history.redo();if(!state.features.some(f=>f.id===selected))selected=null;save();renderAll();mp.actions.sendSync?.(state);}
function applyCamera(){view.setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.k})`);$('zoom-level').textContent=Math.round(camera.k/baseScale*100)+'%';}
function fit(){const w=svg.clientWidth,h=svg.clientHeight;camera.k=Math.max(.15,Math.min(w/1100,h/900));baseScale=camera.k;camera.x=w/2-630*camera.k;camera.y=h/2-435*camera.k;applyCamera();renderMap();}
function zoom(factor,cx=svg.clientWidth/2,cy=svg.clientHeight/2){const next=Math.max(baseScale*.4,Math.min(baseScale*5,camera.k*factor));const ratio=next/camera.k;camera.x=cx-(cx-camera.x)*ratio;camera.y=cy-(cy-camera.y)*ratio;camera.k=next;applyCamera();renderMap();}
function local(e){const b=svg.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];}
function world(e){const [x,y]=local(e);return [(x-camera.x)/camera.k,(y-camera.y)/camera.k];}

function finish(e,cancel=false){
  if(!gesture||e.pointerId!==gesture.pointerId)return;
  const g=gesture;gesture=null;$('draft').innerHTML='';
  if(cancel){
    if(g.before){state.features=g.before;renderMap();}
    if(g.original){state.features=state.features.map(f=>f.id===g.original.id?g.original:f);renderMap();}
    return;
  }
  if(g.kind==='draw'){
    if(g.points.length>0){
      const last=world(e);
      if(Math.hypot(...last.map((n,i)=>n-g.points.at(-1)[i]))>.1)g.points.push(last);
      const f={...createFeature('drawing',g.points),...g.brush};
      state.features.push(f);
      selected=null;
      commit();
      renderMap();
      mp.broadcastAdd(f);
    }
  }
  if(g.kind==='erase')commit();
  if(g.kind==='move'||g.kind==='vertex'){
    commit();
    renderPanel();
    const f=state.features.find(o=>o.id===g.original?.id);
    if(f)mp.broadcastUpdate(f);
  }
  if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
}

function eraseAt(e){
  const id=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-id]')?.dataset.id;
  if(id){
    state.features=state.features.filter(f=>f.id!==id);
    renderMap();
    mp.broadcastDelete(id);
  }
}

svg.addEventListener('pointerdown',e=>{
  if(gesture||![0,1].includes(e.button))return;
  svg.focus({preventScroll:true});
  const p=world(e);
  const pan=space||tool==='pan'||e.button===1;
  const id=e.target.closest('[data-id]')?.dataset.id;
  const vertex=e.target.dataset.vertex;

  if(pan)gesture={kind:'pan',start:local(e),camera:{...camera}};
  else if(tool==='select'){
    if(vertex!==undefined&&selected){
      const f=state.features.find(o=>o.id===selected);
      gesture={kind:'vertex',index:Number(vertex),original:structuredClone(f)};
    } else if(id){
      select(id);
      gesture={kind:'move',start:p,original:structuredClone(state.features.find(f=>f.id===id))};
    } else select(null);
  }
  else if(tool==='erase'){
    gesture={kind:'erase',before:structuredClone(state.features)};
    eraseAt(e);
  }
  else {
    gesture={kind:'draw',points:[p],brush:{color:$('brush-color').value,size:Math.min(30,Math.max(1,Number($('brush-width').value)||3))}};
  }
  if(gesture){
    gesture.pointerId=e.pointerId;
    svg.setPointerCapture(e.pointerId);
  }
  e.preventDefault();
});

svg.addEventListener('pointermove',e=>{
  const p=world(e);
  $('coords-display').textContent=`X: ${Math.round(p[0])}, Z: ${Math.round(p[1])}`;
  mp.broadcastCursor(p[0], p[1], gesture?.kind==='draw');

  if(!gesture||e.pointerId!==gesture.pointerId)return;
  const g=gesture;
  if(g.kind==='pan'){
    const q=local(e);
    camera.x=g.camera.x+q[0]-g.start[0];
    camera.y=g.camera.y+q[1]-g.start[1];
    applyCamera();
  } else if(g.kind==='erase'){
    eraseAt(e);
  } else if(g.kind==='draw'){
    for(const sample of e.getCoalescedEvents?.().length?e.getCoalescedEvents():[e]){
      const q=world(sample),last=g.points.at(-1);
      if(Math.hypot(q[0]-last[0],q[1]-last[1])*camera.k>=.75)g.points.push(q);
    }
    $('draft').innerHTML=`<path d="${path(g.points)}" stroke="${g.brush.color}" stroke-width="${g.brush.size}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if(g.kind==='move'){
    const m=moveFeature(g.original,p[0]-g.start[0],p[1]-g.start[1]);
    state.features=state.features.map(f=>f.id===m.id?m:f);
    renderMap();
  } else if(g.kind==='vertex'){
    const f=structuredClone(g.original);
    f.points[g.index]=p;
    state.features=state.features.map(o=>o.id===f.id?f:o);
    renderMap();
  }
});

svg.addEventListener('pointerup',e=>finish(e));
svg.addEventListener('pointercancel',e=>finish(e,true));
svg.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=local(e);zoom(Math.exp(-e.deltaY*.0015),x,y);},{passive:false});
svg.addEventListener('keydown',e=>{const id=e.target.closest('[data-id]')?.dataset.id;if((e.key==='Enter'||e.key===' ')&&id){e.preventDefault();select(id);showTab(false);}});

function showTab(layers){showLayers=layers;$('layers-panel').hidden=!layers;$('feature-panel').hidden=layers;$('tab-layers').classList.toggle('active',layers);$('tab-feature').classList.toggle('active',!layers);}
$('tools').innerHTML=toolInfo.map(([id,label,key])=>`<button class="tool" data-tool="${id}" title="${label} (${key})" aria-label="${label}" aria-pressed="false"><span class="tool-label">${label}</span></button>`).join('');
$('tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(b)chooseTool(b.dataset.tool);};$('open-layers').onclick=()=>{chooseTool('select');showTab(true);};$('tab-feature').onclick=()=>showTab(false);$('tab-layers').onclick=()=>showTab(true);
$('layers').onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.select){chooseTool('select');select(b.dataset.select);}
  if(b.dataset.visibility){
    const f=state.features.find(f=>f.id===b.dataset.visibility);
    f.visible=!f.visible;
    commit();
    renderMap();
    renderPanel();
    mp.broadcastUpdate(f);
  }
  if(b.dataset.order){
    stack(b.dataset.layer,Number(b.dataset.order));
    const f=state.features.find(o=>o.id===b.dataset.layer);
    if(f)mp.broadcastUpdate(f);
  }
};

$('undo').onclick=()=>travel('undo');$('redo').onclick=()=>travel('redo');$('fit').onclick=fit;$('zoom-in').onclick=()=>zoom(1.25);$('zoom-out').onclick=()=>zoom(.8);$('toggle-grid').onclick=()=>{const el=$('grid-layer');const visible=el.hasAttribute('hidden');el.toggleAttribute('hidden',!visible);$('toggle-grid').setAttribute('aria-pressed',visible);};
$('world-title').oninput=e=>{state.title=e.target.value;save();};
$('world-title').onchange=()=>{commit();mp.broadcastTitle(state.title);};

$('new-world').onclick=()=>$('new-dialog').showModal();$('cancel-new').onclick=()=>$('new-dialog').close();
$('confirm-new').onclick=()=>{state=blankWorld();selected=null;saveBlocked=false;commit();renderAll();mp.actions.sendSync?.(state);$('new-dialog').close();};

// Multiplayer Dialog & Controls
$('open-room-btn').onclick=()=>{
  $('input-player-name').value=mp.playerName;
  $('input-player-color').value=mp.playerColor;
  $('input-room-id').value=mp.roomId;
  $('input-share-url').value=mp.getShareUrl();
  $('room-dialog').showModal();
};
$('close-room-dialog').onclick=()=>$('room-dialog').close();
$('input-player-name').oninput=e=>mp.updateProfile(e.target.value,null);
$('input-player-color').oninput=e=>mp.updateProfile(null,e.target.value);
$('btn-switch-room').onclick=()=>{
  const next=$('input-room-id').value;
  if(next){mp.switchRoom(next);$('input-share-url').value=mp.getShareUrl();toast(`Switched to room "${next}"`);}
};
$('btn-copy-share-dialog').onclick=async()=>{
  await navigator.clipboard.writeText(mp.getShareUrl());
  toast('Copied invite link to clipboard!');
};
$('share-link-btn').onclick=async()=>{
  await navigator.clipboard.writeText(mp.getShareUrl());
  toast('Copied invite link! Send it to your friends to edit together.');
};

// Export & Import World Backups
$('export-world-btn').onclick=()=>{
  const blob=new Blob([encode(state)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`${(state.title||'minecraft-world').toLowerCase().replace(/[^a-z0-9_-]/g,'-')}.json`;
  a.click();
  toast('World exported as JSON!');
};
$('import-world-btn').onclick=()=>$('import-file-input').click();
$('import-file-input').onchange=async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  try{
    const text=await file.text();
    state=decode(text);
    selected=null;
    commit();
    renderAll();
    mp.actions.sendSync?.(state);
    toast('World imported successfully!');
  }catch{
    toast('Invalid world file format.');
  }
  e.target.value='';
};

// Biome Swatch Presets
document.querySelectorAll('.swatch').forEach(btn=>{
  btn.onclick=()=>{
    $('brush-color').value=btn.dataset.color;
    $('brush-width').value=btn.dataset.size;
    chooseTool('drawing');
  };
});

window.addEventListener('keydown',e=>{
  const input=e.target.closest('input,textarea,[contenteditable]');
  if(input||$('new-dialog').open||$('room-dialog').open)return;
  if(e.code==='Space'){space=true;e.preventDefault();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travel(e.shiftKey?'redo':'undo');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();travel('redo');return;}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='Escape'){if(gesture)finish({pointerId:gesture.pointerId},true);select(null);chooseTool('select');}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
  const t=toolInfo.find(t=>t[2].toLowerCase()===e.key.toLowerCase());
  if(t)chooseTool(t[0]);
});

window.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});
window.addEventListener('blur',()=>{space=false;});
window.addEventListener('pagehide',save);

$('backdrop').innerHTML=backdrop();
chooseTool('drawing');
renderAll();
requestAnimationFrame(fit);
new ResizeObserver(()=>{applyCamera();}).observe(svg);
save();
if(saveBlocked){toast('The saved map could not be opened. Your existing data has been preserved.');}
