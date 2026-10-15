import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../dist/model.js';
import {backdrop} from '../dist/render.js';
test('a new world starts with no pre-made map features',async()=>{
 assert.equal(typeof model.restoreWorld,'function');
 const s=await model.restoreWorld(null);assert.deepEqual(s,{version:1,title:'Untitled world',features:[]});
});
test('restoring a saved drawing preserves user geometry and lore',async()=>{
 const f={...model.createFeature('settlement',[[20,30],[60,70]]),name:'My place',lore:'My story'};
 const world={version:1,title:'My map',features:[f]};
 assert.deepEqual(await model.restoreWorld(model.encode(world)),world);
});
test('backdrop has only an optional grid, with no built-in geography',()=>{
 const art=backdrop();assert.doesNotMatch(art,/<path|<text|<use/);assert.match(art,/id="grid-layer"/);
});
