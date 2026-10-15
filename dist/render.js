export const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function path(points, closed=false){
  const d=points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ');
  return closed ? `${d} Z` : d;
}
export function bounds(f){const xs=f.points.map(p=>p[0]),ys=f.points.map(p=>p[1]);return {x:Math.min(...xs)-8,y:Math.min(...ys)-8,w:Math.max(...xs)-Math.min(...xs)+16,h:Math.max(...ys)-Math.min(...ys)+16};}
export function renderFeature(f,selected){
 if(!f.visible)return '';
 const first=f.points[0];
 const isClosed=Boolean(f.closed);
 const isFilled=Boolean(f.fill);
 const op=f.opacity!==undefined?Math.max(0.05,Math.min(1,Number(f.opacity))):1;
 const fillVal=isFilled?(f.fillColor||f.color):'none';
 const fillOp=isFilled?(f.fillOpacity!==undefined?f.fillOpacity:0.45):0;

 let art=f.points.length===1
  ? `<circle cx="${first[0]}" cy="${first[1]}" r="${Math.max(1,f.size/2)}" fill="${f.color}" opacity="${op}"/><circle cx="${first[0]}" cy="${first[1]}" r="10" fill="transparent"/>`
  : `<path d="${path(f.points,isClosed)}" fill="${fillVal}" fill-opacity="${fillOp}" stroke="${f.color}" stroke-width="${f.size}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/><path d="${path(f.points,isClosed)}" fill="none" stroke="transparent" stroke-width="${Math.max(18,f.size+10)}"/>`;
 const b=bounds(f);
 if(selected)art+=`<rect class="selection" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4"/>`;
 if(f.label&&f.name){const mid=f.points[Math.floor(f.points.length/2)];art+=`<text class="feature-label" text-anchor="middle" x="${mid[0]}" y="${mid[1]-15}">${esc(f.name)}</text>`;}
 return `<g data-id="${esc(f.id)}" role="button" aria-label="${esc(f.name||f.type+' drawing')}" tabindex="0">${art}</g>`;
}
export function backdrop(){return `<g id="grid-layer" hidden><rect x="-6000" y="-6000" width="12000" height="12000" fill="url(#grid)"/></g>`;}
