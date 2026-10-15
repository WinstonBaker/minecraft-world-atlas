import assert from 'node:assert/strict';
const {chromium}=await import(process.env.ATLAS_PLAYWRIGHT || 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.ATLAS_BROWSER?{executablePath:process.env.ATLAS_BROWSER}:{})});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-atlas-v1')));
 const draw=async(x,y)=>{const r=await page.locator('#map').boundingBox();await page.mouse.move(r.x+x,r.y+y);await page.mouse.down();await page.mouse.move(r.x+x+100,r.y+y+30,{steps:35});await page.mouse.up();};
 await page.goto('http://localhost:4173');await page.waitForFunction(()=>localStorage.getItem('world-atlas-v1'));
 assert.equal(await page.locator('#map').getAttribute('data-tool'),'drawing');
 assert.equal(await page.locator('[data-palette="brush-color"] button').count(),10);
 await page.locator('[data-palette="brush-color"]').getByRole('button',{name:'River blue',exact:true}).click();
 assert.equal(await page.locator('#brush-color').inputValue(),'#4b91b8');
 assert.equal(await page.locator('symbol,use,image,img,#paper,#export,#import').count(),0);
 assert.equal(await page.getByRole('button',{name:'Village',exact:true}).count(),0);
 await page.locator('#brush-color').fill('#225588');await page.locator('#brush-width').fill('6');
 await draw(160,180);await draw(330,260);await draw(500,340);
 let state=await saved();assert.equal(state.features.length,3);assert.equal(await page.locator('#map').getAttribute('data-tool'),'drawing');
 for(const f of state.features){assert.equal(f.type,'drawing');assert.equal(f.color,'#225588');assert.equal(f.size,6);assert.ok(f.points.length>20);}
 const first=structuredClone(state.features[0]);
 await page.getByRole('button',{name:'Erase',exact:true}).click();const r=await page.locator('#map').boundingBox();await page.mouse.click(r.x+200,r.y+192);
 assert.equal((await saved()).features.length,2);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await saved()).features[0],first);
 await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await saved()).features.length,2);await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByRole('button',{name:'Select',exact:true}).click();await page.mouse.click(r.x+200,r.y+192);
 await page.getByRole('textbox',{name:'Name',exact:true}).fill('My river');await page.getByRole('textbox',{name:'Lore',exact:true}).fill('A story written after drawing.');await page.getByRole('textbox',{name:'Lore',exact:true}).blur();
 await page.locator('[data-palette="feature-color"]').getByRole('button',{name:'Sand',exact:true}).click();assert.equal((await saved()).features[0].color,'#d7bd89');assert.equal(await page.locator('#brush-color').inputValue(),'#225588');
 const before=(await saved()).features[0];await page.mouse.move(r.x+200,r.y+192);await page.mouse.down();await page.mouse.move(r.x+240,r.y+222,{steps:8});await page.mouse.up();const moved=(await saved()).features[0],dx=moved.points[0][0]-before.points[0][0],dy=moved.points[0][1]-before.points[0][1];assert.ok(Math.abs(dx)>1);assert.ok(moved.points.every((p,i)=>Math.abs(p[0]-before.points[i][0]-dx)<.01&&Math.abs(p[1]-before.points[i][1]-dy)<.01));
 await page.getByRole('button',{name:'Bring forward',exact:true}).click();assert.equal((await saved()).features[1].name,'My river');
 await page.getByRole('checkbox',{name:'Visible on map'}).uncheck();assert.equal(await page.locator(`[data-id="${first.id}"]`).count(),0);await page.getByRole('checkbox',{name:'Visible on map'}).check();
 await page.getByRole('button',{name:'Toggle grid'}).click();assert.equal(await page.locator('#grid-layer').isVisible(),true);await page.getByRole('button',{name:'Toggle grid'}).click();
 const oldZoom=await page.locator('#zoom-level').textContent();await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.notEqual(await page.locator('#zoom-level').textContent(),oldZoom);
 await page.getByRole('button',{name:'Pan',exact:true}).click();const map=await page.locator('#map').boundingBox(),camera=await page.locator('#viewport').getAttribute('transform');await page.mouse.move(map.x+100,map.y+200);await page.mouse.down();await page.mouse.move(map.x+150,map.y+230,{steps:8});await page.mouse.up();assert.notEqual(await page.locator('#viewport').getAttribute('transform'),camera);
 const complete=await saved();await page.reload();await page.waitForFunction(()=>document.querySelector('#map').dataset.tool==='drawing');assert.deepEqual(await saved(),complete);
 await page.getByRole('button',{name:'Layers',exact:true}).click();await page.locator('#layers').getByRole('button',{name:'My river',exact:true}).click();await page.locator('#tab-feature').click();assert.equal(await page.getByRole('textbox',{name:'Lore',exact:true}).inputValue(),'A story written after drawing.');
 await page.getByRole('button',{name:'Draw',exact:true}).click();await page.screenshot({path:'../../work/atlas-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>document.querySelector('#map').dataset.tool==='drawing');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'../../work/atlas-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Browser checks passed: default freehand drawing, continuous strokes, brush settings, fine pointer sampling, erasing, undo/redo, optional lore, movement, layers, visibility, zoom/pan, autosave/restore, mobile, no preset assets or page errors.');
}finally{await browser.close();}
