export const TYPES = ['drawing','river','road','forest','mountain','settlement'];
export const DEFAULTS = {drawing:{name:'',color:'#394939',size:3},river:{name:'',color:'#72a6ae',size:7},road:{name:'',color:'#a38a61',size:4},forest:{name:'',color:'#668264',size:4},mountain:{name:'',color:'#8f9180',size:4},settlement:{name:'',color:'#b47d57',size:4}};
export function createFeature(type,points){if(!TYPES.includes(type))throw Error('Unknown feature');return {id:crypto.randomUUID(),type,points:structuredClone(points),...DEFAULTS[type],lore:'',visible:true,label:true};}
export function moveFeature(f,dx,dy){return {...f,points:f.points.map(([x,y])=>[x+dx,y+dy])};}
export function reorder(features,id,direction){const copy=[...features],i=copy.findIndex(f=>f.id===id),j=i+direction;if(i>=0&&j>=0&&j<copy.length)[copy[i],copy[j]]=[copy[j],copy[i]];return copy;}
function drawingData(state){return {version:state.version,title:state.title,features:state.features.map(({id,type,points,name,color,size,lore,visible,label})=>({id,type,points,name,color,size,lore,visible,label}))};}
export const encode=state=>JSON.stringify(drawingData(state));
export function decode(raw){const s=JSON.parse(raw);if(s?.version!==1||typeof s.title!=='string'||s.title.length>120||!Array.isArray(s.features)||s.features.length>3000)throw Error('This is not a supported Atlas file.');const ids=new Set();for(const f of s.features){if(!f||!TYPES.includes(f.type)||typeof f.id!=='string'||ids.has(f.id)||typeof f.name!=='string'||f.name.length>160||typeof f.lore!=='string'||f.lore.length>6000||!/^#[0-9a-f]{6}$/i.test(f.color)||typeof f.visible!=='boolean'||typeof f.label!=='boolean'||!Number.isFinite(f.size)||f.size<=0||f.size>30||!Array.isArray(f.points)||!f.points.length||f.points.length>20000||f.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>1e7)))throw Error('The Atlas file contains invalid features.');ids.add(f.id);}return drawingData(s);}
export class History{constructor(state){this.items=[structuredClone(state)];this.index=0;}push(state){const next=structuredClone(state);if(JSON.stringify(next)===JSON.stringify(this.items[this.index]))return;this.items=this.items.slice(0,this.index+1);this.items.push(next);if(this.items.length>80)this.items.shift();this.index=this.items.length-1;}undo(){if(this.canUndo)this.index--;return structuredClone(this.items[this.index]);}redo(){if(this.canRedo)this.index++;return structuredClone(this.items[this.index]);}get canUndo(){return this.index>0;}get canRedo(){return this.index<this.items.length-1;}}
export function blankWorld(){return {version:1,title:'Untitled world',features:[]};}
// Fingerprints identify only untouched starter features from the first release.
// Edited features and user-created records are kept as-is.
const LEGACY_DEMO_HASHES=new Set(["c9ebc915a90440093d5439552bd15580da19ebcb1b68be13ec85dbef9e39fb88", "7cad1981f9ad39939d6d57674357f65a31c2775ec4214461f2df13069063836e", "31348f7f9940c6291bacd4739af1999e0b8af34685c47e00bc7f839d7b526b0a", "9898173e33e8d7e1bd9d6913374d8d7132b8a345fef34056ad3940653e0f5a7d", "9659fb9f154f5922b9eedb5aa7ac20628fbcd625ec0bd3b7e6068c90c4ebcd3c", "30ccaecb2ca354e62ac5426827a4121506218512b52969cad221cf1210deb220", "9b6992d654fce8b748cda6729cb9106b354f048b223c5f1966b49c8e6e07e695", "4b27fe19702377ff3c92d55e5234662260343976d85f4f4964d68c0c38387d9a"]);
export async function restoreWorld(raw){
 if(!raw)return blankWorld();
 const world=decode(raw);
 const keep=await Promise.all(world.features.map(async({id,...feature})=>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(feature)));
  const hash=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
  return !LEGACY_DEMO_HASHES.has(hash);
 }));
 const features=world.features.filter((_,i)=>keep[i]);
 return {...world,features,title:features.length===0&&world.title==='The Overworld'?'Untitled world':world.title};
}
