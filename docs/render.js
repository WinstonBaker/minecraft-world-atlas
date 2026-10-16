export const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function smoothClosedPath(points, tension = 1) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M${points[0][0]} ${points[0][1]}`;
  if (points.length === 2) return `M${points[0][0]} ${points[0][1]} L${points[1][0]} ${points[1][1]} Z`;

  const n = points.length;
  let d = `M${points[0][0]} ${points[0][1]}`;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    const cp1x = p1[0] + (p2[0] - p0[0]) * (tension / 6);
    const cp1y = p1[1] + (p2[1] - p0[1]) * (tension / 6);
    const cp2x = p2[0] - (p3[0] - p1[0]) * (tension / 6);
    const cp2y = p2[1] - (p3[1] - p1[1]) * (tension / 6);

    d += ` C${Math.round(cp1x * 10) / 10} ${Math.round(cp1y * 10) / 10}, ${Math.round(cp2x * 10) / 10} ${Math.round(cp2y * 10) / 10}, ${p2[0]} ${p2[1]}`;
  }

  return d + ' Z';
}

export function path(points, closed=false){
  if (closed && points.length >= 3) {
    return smoothClosedPath(points, 1);
  }
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
