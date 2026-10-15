export const TYPES = ['river','road','forest','mountain','settlement'];
export const DEFAULTS = {river:{name:'Unnamed river',color:'#72a6ae',size:7},road:{name:'Unnamed road',color:'#a38a61',size:4},forest:{name:'Unnamed forest',color:'#668264',size:1},mountain:{name:'Unnamed mountains',color:'#8f9180',size:1},settlement:{name:'Unnamed village',color:'#b47d57',size:1}};
export function createFeature(type,points){if(!TYPES.includes(type))throw Error('Unknown feature');return {id:crypto.randomUUID(),type,points:structuredClone(points),...DEFAULTS[type],lore:'',visible:true,label:true};}
export function moveFeature(f,dx,dy){return {...f,points:f.points.map(([x,y])=>[x+dx,y+dy])};}
export function reorder(features,id,direction){const copy=[...features],i=copy.findIndex(f=>f.id===id),j=i+direction;if(i>=0&&j>=0&&j<copy.length)[copy[i],copy[j]]=[copy[j],copy[i]];return copy;}
export const encode=state=>JSON.stringify(state);
export function decode(raw){const s=JSON.parse(raw);if(s?.version!==1||typeof s.title!=='string'||s.title.length>120||!Array.isArray(s.features)||s.features.length>3000)throw Error('This is not a supported Atlas file.');const ids=new Set();for(const f of s.features){if(!f||!TYPES.includes(f.type)||typeof f.id!=='string'||ids.has(f.id)||typeof f.name!=='string'||f.name.length>160||typeof f.lore!=='string'||f.lore.length>6000||!/^#[0-9a-f]{6}$/i.test(f.color)||typeof f.visible!=='boolean'||typeof f.label!=='boolean'||!Number.isFinite(f.size)||f.size<=0||f.size>30||!Array.isArray(f.points)||!f.points.length||f.points.length>20000||f.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>1e7)))throw Error('The Atlas file contains invalid features.');ids.add(f.id);}return s;}
export class History{constructor(state){this.items=[structuredClone(state)];this.index=0;}push(state){const next=structuredClone(state);if(encode(next)===encode(this.items[this.index]))return;this.items=this.items.slice(0,this.index+1);this.items.push(next);if(this.items.length>80)this.items.shift();this.index=this.items.length-1;}undo(){if(this.canUndo)this.index--;return structuredClone(this.items[this.index]);}redo(){if(this.canRedo)this.index++;return structuredClone(this.items[this.index]);}get canUndo(){return this.index>0;}get canRedo(){return this.index<this.items.length-1;}}
export function sampleWorld(){const make=(type,points,name,lore,size)=>({...createFeature(type,points),name,lore,size:size??DEFAULTS[type].size});return {version:1,title:'The Overworld',features:[
 make('road',[[400,610],[490,575],[560,510],[640,487],[741,530],[860,625]],'The Old Way','A well-worn trail between the valley and the coast.'),
 make('river',[[652,214],[634,278],[666,335],[642,389],[663,447],[650,510],[690,564],[681,628],[714,715]],'Willow River','A quiet river carrying mountain snowmelt through the heart of the valley.'),
 make('mountain',[[587,252]],'The Cloudpeaks','On clear mornings, their snowy crowns catch the very first light.',1.55),
 make('mountain',[[800,330]],'Eastwatch Ridge','An old watchtower once stood along this ridge.',0.85),
 make('forest',[[424,417]],'Bramblewood','A deep, mossy woodland. Follow the lanterns, and you may find your way home.',1.65),
 make('forest',[[792,552]],'Whispering Pines','The trees sound almost like voices when the sea wind blows.',1.25),
 make('settlement',[[560,516]],'Willowbrook','A little village of warm hearths, curious gardeners, and very good bread.',1.2),
 make('settlement',[[860,632]],'Mossport','Fishing boats, salt-stained roofs, and stories from faraway shores.',0.9)
]};}
