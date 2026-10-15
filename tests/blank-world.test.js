import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as model from '../dist/model.js';
import {backdrop} from '../dist/render.js';
const legacy=JSON.parse(readFileSync(new URL('./fixtures/legacy-world.json',import.meta.url)));
test('a new world starts with no pre-made map features',async()=>{
 assert.equal(typeof model.restoreWorld,'function');
 const s=await model.restoreWorld(null);assert.deepEqual(s,{version:1,title:'Untitled world',features:[]});
});
test('legacy demo content is removed without removing edited or user-created places',async()=>{
 assert.equal(typeof model.restoreWorld,'function');
 const modified=structuredClone(legacy);modified.title='Our Minecraft world';modified.features[0].lore='My own story';const own=model.createFeature('forest',[[10,20]]);modified.features.push(own);
 const s=await model.restoreWorld(JSON.stringify(modified));assert.equal(s.title,'Our Minecraft world');assert.deepEqual(s.features,[modified.features[0],own]);
 const empty=await model.restoreWorld(JSON.stringify(legacy));assert.equal(empty.features.length,0);assert.equal(empty.title,'Untitled world');
});
test('backdrop has only an optional grid, with no built-in geography',()=>{
 const art=backdrop();assert.doesNotMatch(art,/<path|<text|<use/);assert.match(art,/id="grid-layer"/);
});
