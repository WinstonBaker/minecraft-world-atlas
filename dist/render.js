export const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function path(points){return points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ');}
export function bounds(f){const xs=f.points.map(p=>p[0]),ys=f.points.map(p=>p[1]);return {x:Math.min(...xs)-8,y:Math.min(...ys)-8,w:Math.max(...xs)-Math.min(...xs)+16,h:Math.max(...ys)-Math.min(...ys)+16};}
export function renderFeature(f,selected){
 if(!f.visible)return '';
 const first=f.points[0];
 let art=f.points.length===1
  ? `<circle cx="${first[0]}" cy="${first[1]}" r="${Math.max(1,f.size/2)}" fill="${f.color}"/><circle cx="${first[0]}" cy="${first[1]}" r="10" fill="transparent"/>`
  : `<path d="${path(f.points)}" fill="none" stroke="${f.color}" stroke-width="${f.size}" stroke-linecap="round" stroke-linejoin="round"/><path d="${path(f.points)}" fill="none" stroke="transparent" stroke-width="${Math.max(18,f.size+10)}"/>`;
 const b=bounds(f);
 if(selected)art+=`<rect class="selection" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4"/>`;
 if(f.label&&f.name){const mid=f.points[Math.floor(f.points.length/2)];art+=`<text class="feature-label" text-anchor="middle" x="${mid[0]}" y="${mid[1]-15}">${esc(f.name)}</text>`;}
 return `<g data-id="${esc(f.id)}" role="button" aria-label="${esc(f.name||f.type+' drawing')}" tabindex="0">${art}</g>`;
}
export function backdrop(){return `<g id="grid-layer" hidden><rect x="-6000" y="-6000" width="12000" height="12000" fill="url(#grid)"/></g>`;}
