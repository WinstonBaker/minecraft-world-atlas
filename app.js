import {createFeature,moveFeature,reorder,encode,decode,History,blankWorld,restoreWorld,createCirclePoints,subdividePoints,simplifyPoints,resampleLoop} from './model.js?v=draw-freely-7';
import {path,renderFeature,backdrop,esc} from './render.js?v=draw-freely-7';
import {SyncManager} from './sync.js';

const $=id=>document.getElementById(id),KEY='world-atlas-v1';
let state=blankWorld(),saveBlocked=false;
try{const raw=localStorage.getItem(KEY);state=await restoreWorld(raw);}catch{saveBlocked=true;}
const history=new History(state);let selected=null,editingPoints=false,tool='drawing',gesture=null,space=false,showLayers=false,toastTimer;
const svg=$('map'),view=$('viewport');let camera={x:0,y:0,k:1},baseScale=1;
const toolInfo=[['drawing','Draw','B'],['loop','Loop / Topology','L'],['erase','Erase','E'],['select','Select','V'],['pan','Pan','H']];

function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}

function saveLocal(){
  if(saveBlocked)return;
  try{
    localStorage.setItem(KEY,encode(state));
    $('save-status').textContent='Saved';
    $('save-status').classList.remove('error');
  }catch{
    $('save-status').textContent='Local storage full';
    $('save-status').classList.add('error');
  }
}

function commit(){
  history.push(state);
  saveLocal();
  updateHistory();
  renderLayers();
  sync.publishState(state);
}

function updateHistory(){$('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo;}

// Remote Cursors
const remoteCursors = new Map();
function updateRemoteCursor(data) {
  remoteCursors.set(data.senderId, { ...data, lastSeen: Date.now() });
  renderRemoteCursors();
}

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [id, c] of remoteCursors.entries()) {
    if (now - c.lastSeen > 6000) {
      remoteCursors.delete(id);
      changed = true;
    }
  }
  if (changed) renderRemoteCursors();
}, 2500);

function renderRemoteCursors() {
  const container = $('remote-cursors');
  if (!container) return;
  let svgMarkup = '';
  for (const [, c] of remoteCursors.entries()) {
    const name = c.name || 'Friend';
    const color = c.color || '#3498db';
    const pencil = c.isDrawing ? ' ✎' : '';
    svgMarkup += `
      <g class="remote-cursor" transform="translate(${c.x} ${c.y})" style="pointer-events:none">
        <path d="M0 0 L10 10 L6 11 L9 18 L6.5 19 L3.5 12 L0 15 Z" fill="${color}" stroke="#ffffff" stroke-width="1.2" />
        <g transform="translate(12, 6)">
          <rect x="0" y="0" width="${name.length * 7 + 16}" height="18" rx="4" fill="${color}" opacity="0.9" />
          <text x="6" y="13" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#ffffff">${esc(name)}${pencil}</text>
        </g>
      </g>
    `;
  }
  container.innerHTML = svgMarkup;
}

// Global Board Sync (Single shared world across all friends)
const sync = new SyncManager({
  getState: () => state,
  showToast: toast,
  onRemoteState: (remoteState) => {
    if (remoteState && Array.isArray(remoteState.features)) {
      state = remoteState;
      saveLocal();
      renderAll();
      toast('Map synced with friends!');
    }
  },
  onRemoteCursor: (cursorData) => {
    updateRemoteCursor(cursorData);
  }
});

function chooseTool(next){
  tool=next;
  document.querySelector('main').classList.toggle('editing',next==='select');
  if(next!=='select'){
    selected=null;
    editingPoints=false;
    renderPanel();
  }
  svg.dataset.tool=next;
  document.querySelectorAll('.tool').forEach(b=>{
    b.classList.toggle('active',b.dataset.tool===next);
    b.setAttribute('aria-pressed',b.dataset.tool===next);
  });
  renderMap();
}

function renderMap(){
  $('features').innerHTML=state.features.map(f=>renderFeature(f,f.id===selected&&tool==='select')).join('');
  const f=state.features.find(f=>f.id===selected);
  $('handles').innerHTML=f?.visible&&tool==='select'&&editingPoints?f.points.map((p,i)=>`<circle class="vertex" data-vertex="${i}" cx="${p[0]}" cy="${p[1]}" r="${5/camera.k}" stroke-width="${1.5/camera.k}"/>`).join(''):'';
}

function select(id){
  selected=id;
  editingPoints=false;
  renderMap();
  renderPanel();
  renderLayers();
}

function renderPanel(){
  const f=state.features.find(f=>f.id===selected);
  if(!f){$('feature-panel').innerHTML=`<p class="empty-copy">Select a feature to edit.</p>`;return;}
  
  const typeLabel = f.type === 'loop' ? 'Topology contour' : f.type === 'settlement' ? 'Village' : esc(f.type);
  const opacityVal = f.opacity !== undefined ? Math.round(f.opacity * 100) : 100;

  $('feature-panel').innerHTML=`
    <div class="feature-tag">${typeLabel}</div>
    <label class="field">Name<input id="feature-name" type="text" maxlength="160" value="${esc(f.name)}" placeholder="Name"></label>
    <label class="field">Lore<textarea id="feature-lore" maxlength="6000" placeholder="Description">${esc(f.lore)}</textarea></label>
    <label class="field">Stroke Width<input id="feature-size" type="range" min="1" max="18" step="0.5" value="${f.size}"></label>
    
    <div class="appearance"><label for="feature-color">Border Color</label><input id="feature-color" type="color" value="${f.color}"></div>
    
    <label class="checkbox"><input id="feature-fill" type="checkbox" ${f.fill?'checked':''}> Fill shape</label>
    <div class="appearance"><label for="feature-fill-color">Fill Color</label><input id="feature-fill-color" type="color" value="${f.fillColor || f.color}"></div>
    
    <label class="field">Opacity / Transparency (${opacityVal}%)<input id="feature-opacity" type="range" min="0.1" max="1" step="0.05" value="${f.opacity !== undefined ? f.opacity : 1}"></label>
    <label class="checkbox"><input id="feature-closed" type="checkbox" ${f.closed?'checked':''}> Closed contour loop</label>

    <div class="topology-buttons">
      <button id="add-detail-pts" title="Add intermediate vertices to sculpt finer contours">➕ Detail Points</button>
      <button id="simplify-pts" title="Smooth / reduce vertex count">➖ Simplify</button>
    </div>

    <label class="checkbox"><input id="feature-label" type="checkbox" ${f.label?'checked':''}> Show name on map</label>
    <label class="checkbox"><input id="feature-visible" type="checkbox" ${f.visible?'checked':''}> Visible on map</label>
    
    <button id="reshape" aria-pressed="${editingPoints}">${editingPoints ? '✓ Done editing points' : 'Edit points (Morph)'}</button>
    <div class="stacking"><button id="send-back">Send back</button><button id="bring-front">Bring forward</button></div>
    <button class="delete" id="delete-feature">Remove this feature</button>
  `;

  for(const [id,prop]of [
    ['feature-name','name'],
    ['feature-lore','lore'],
    ['feature-size','size'],
    ['feature-color','color'],
    ['feature-fill','fill'],
    ['feature-fill-color','fillColor'],
    ['feature-opacity','opacity'],
    ['feature-closed','closed'],
    ['feature-label','label'],
    ['feature-visible','visible']
  ]){
    const input=$(id);
    if (!input) continue;
    input.addEventListener('input',()=>{
      const feature=state.features.find(o=>o.id===selected);
      if (!feature) return;
      feature[prop]=input.type==='checkbox'?input.checked:['size','opacity'].includes(prop)?Number(input.value):input.value;
      renderMap();
      saveLocal();
    });
    input.addEventListener('change',()=>{
      commit();
    });
  }

  $('reshape').onclick=()=>{
    editingPoints=!editingPoints;
    $('reshape').setAttribute('aria-pressed',editingPoints);
    $('reshape').textContent = editingPoints ? '✓ Done editing points' : 'Edit points (Morph)';
    renderMap();
  };

  $('add-detail-pts').onclick=()=>{
    f.points=subdividePoints(f.points,f.closed);
    commit();
    renderMap();
    renderPanel();
    toast('Added detail points to contour! Drag to sculpt.');
  };

  $('simplify-pts').onclick=()=>{
    f.points=simplifyPoints(f.points);
    commit();
    renderMap();
    renderPanel();
    toast('Simplified contour points.');
  };

  $('send-back').onclick=()=>{stack(f.id,-1);};
  $('bring-front').onclick=()=>{stack(f.id,1);};
  $('delete-feature').onclick=remove;
  $('send-back').disabled=state.features[0]?.id===f.id;
  $('bring-front').disabled=state.features.at(-1)?.id===f.id;
}

function renderLayers(){
  $('layers').innerHTML=[...state.features].reverse().map((f,i)=>`
    <div class="layer-row ${selected===f.id?'selected':''}">
      <button class="eye" data-visibility="${esc(f.id)}" title="${f.visible?'Hide':'Show'} ${esc(f.name)}" aria-label="${f.visible?'Hide':'Show'} ${esc(f.name)}">${f.visible?'Hide':'Show'}</button>
      <button class="layer-name" data-select="${esc(f.id)}">${esc(f.name||(f.type==='loop'?'Contour':('Unnamed '+f.type)))}</button>
      <div class="layer-arrows">
        <button data-order="1" data-layer="${esc(f.id)}" aria-label="Bring forward" ${i===0?'disabled':''}>Up</button>
        <button data-order="-1" data-layer="${esc(f.id)}" aria-label="Send back" ${i===state.features.length-1?'disabled':''}>Down</button>
      </div>
    </div>
  `).join('')||'<p class="layer-help">No features yet.</p>';
}

function stack(id,d){state.features=reorder(state.features,id,d);commit();renderMap();renderPanel();}
function remove(){
  if(!selected)return;
  const toDelete = selected;
  state.features=state.features.filter(f=>f.id!==toDelete);
  selected=null;
  commit();
  renderMap();
  renderPanel();
}
function renderAll(){renderMap();renderPanel();renderLayers();$('world-title').value=state.title;updateHistory();}
function travel(dir){state=dir==='undo'?history.undo():history.redo();if(!state.features.some(f=>f.id===selected))selected=null;saveLocal();renderAll();sync.publishState(state);}
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
      const f={
        ...createFeature('drawing',g.points),
        color:g.brush.color,
        size:g.brush.size,
        fill:g.brush.fill,
        fillColor:g.brush.fillColor,
        opacity:g.brush.opacity,
        closed:Boolean(g.brush.fill)
      };
      state.features.push(f);
      selected=null;
      commit();
      renderMap();
    }
  }
  if(g.kind==='loop'){
    const last=world(e);
    if(g.points.length>0&&Math.hypot(last[0]-g.points.at(-1)[0],last[1]-g.points.at(-1)[1])>.1)g.points.push(last);
    
    let pts;
    const totalDist = g.points.reduce((acc, pt, i) => i === 0 ? 0 : acc + Math.hypot(pt[0]-g.points[i-1][0], pt[1]-g.points[i-1][1]), 0);
    
    if(g.points.length <= 2 || totalDist < 20){
      pts = createCirclePoints(g.start[0], g.start[1], 65, 12);
    } else {
      pts = resampleLoop(g.points, 16);
    }

    const f={
      ...createFeature('loop',pts),
      name:'Topology contour',
      color:g.brush.color,
      fillColor:g.brush.fillColor,
      fill:g.brush.fill,
      opacity:g.brush.opacity,
      size:g.brush.size,
      closed:true
    };
    state.features.push(f);
    commit();
    renderMap();
    chooseTool('select');
    select(f.id);
    editingPoints=true;
    $('reshape')?.setAttribute('aria-pressed','true');
    renderMap();
    toast('Custom loop created! Drag any point around your shape to morph it.');
  }
  if(g.kind==='erase')commit();
  if(g.kind==='move'||g.kind==='vertex'){
    commit();
    renderPanel();
  }
  if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
}

function eraseAt(e){
  const id=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-id]')?.dataset.id;
  if(id){
    state.features=state.features.filter(f=>f.id!==id);
    renderMap();
    commit();
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
  else if(tool==='loop'){
    gesture={
      kind:'loop',
      start:p,
      points:[p],
      brush:{
        color:$('brush-color').value,
        size:Math.min(30,Math.max(1,Number($('brush-width').value)||2.5)),
        fill:$('brush-fill-toggle').checked,
        fillColor:$('brush-fill-color').value||$('brush-color').value,
        opacity:Number($('brush-opacity').value)||0.65
      }
    };
  }
  else {
    gesture={
      kind:'draw',
      points:[p],
      brush:{
        color:$('brush-color').value,
        size:Math.min(30,Math.max(1,Number($('brush-width').value)||3)),
        fill:$('brush-fill-toggle').checked,
        fillColor:$('brush-fill-color').value||$('brush-color').value,
        opacity:Number($('brush-opacity').value)||1
      }
    };
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
  sync.publishCursor(p[0], p[1], gesture?.kind==='draw'||gesture?.kind==='loop');

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
    const dStr = path(g.points, Boolean(g.brush.fill));
    const fillVal = g.brush.fill ? g.brush.fillColor : 'none';
    $('draft').innerHTML=`<path d="${dStr}" stroke="${g.brush.color}" stroke-width="${g.brush.size}" fill="${fillVal}" fill-opacity="0.45" stroke-linecap="round" stroke-linejoin="round" opacity="${g.brush.opacity}"/>`;
  } else if(g.kind==='loop'){
    for(const sample of e.getCoalescedEvents?.().length?e.getCoalescedEvents():[e]){
      const q=world(sample),last=g.points.at(-1);
      if(Math.hypot(q[0]-last[0],q[1]-last[1])*camera.k>=.75)g.points.push(q);
    }
    const fillVal=g.brush.fill?g.brush.fillColor:'none';
    $('draft').innerHTML=`<path d="${path(g.points,true)}" stroke="${g.brush.color}" stroke-width="${g.brush.size}" fill="${fillVal}" fill-opacity="0.4" stroke-dasharray="4 4" opacity="${g.brush.opacity}"/>`;
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
$('tools').onclick=e=>{const b=e.target.closest('[data-tool]');if(b)chooseTool(b.dataset.tool);};
$('open-layers').onclick=()=>{chooseTool('select');showTab(true);};
$('tab-feature').onclick=()=>showTab(false);
$('tab-layers').onclick=()=>showTab(true);

$('layers').onclick=e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.select){chooseTool('select');select(b.dataset.select);}
  if(b.dataset.visibility){
    const f=state.features.find(f=>f.id===b.dataset.visibility);
    f.visible=!f.visible;
    commit();
    renderMap();
    renderPanel();
  }
  if(b.dataset.order){
    stack(b.dataset.layer,Number(b.dataset.order));
  }
};

$('undo').onclick=()=>travel('undo');
$('redo').onclick=()=>travel('redo');
$('fit').onclick=fit;
$('zoom-in').onclick=()=>zoom(1.25);
$('zoom-out').onclick=()=>zoom(.8);
$('toggle-grid').onclick=()=>{const el=$('grid-layer');const visible=el.hasAttribute('hidden');el.toggleAttribute('hidden',!visible);$('toggle-grid').setAttribute('aria-pressed',visible);};
$('world-title').oninput=e=>{state.title=e.target.value;saveLocal();};
$('world-title').onchange=()=>commit();

// Brush Settings
$('brush-opacity').oninput=e=>{
  $('brush-opacity-val').textContent=Math.round(e.target.value*100)+'%';
};

// Player Profile Dialog
$('player-name-label').textContent = sync.playerName;
$('btn-player-profile').onclick=()=>{
  $('input-player-name').value = sync.playerName;
  $('input-player-color').value = sync.playerColor;
  $('profile-dialog').showModal();
};
$('close-profile-dialog').onclick=()=>{
  sync.setPlayerName($('input-player-name').value);
  sync.setPlayerColor($('input-player-color').value);
  $('player-name-label').textContent = sync.playerName;
  $('profile-dialog').close();
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
    $('brush-fill-color').value=btn.dataset.color;
    $('brush-width').value=btn.dataset.size;
    chooseTool('drawing');
  };
});

window.addEventListener('keydown',e=>{
  const input=e.target.closest('input,textarea,[contenteditable]');
  if(input||$('profile-dialog').open)return;
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
window.addEventListener('pagehide',saveLocal);

$('backdrop').innerHTML=backdrop();
chooseTool('drawing');
renderAll();
requestAnimationFrame(fit);
new ResizeObserver(()=>{applyCamera();}).observe(svg);
saveLocal();
