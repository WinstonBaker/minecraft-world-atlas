import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFeature, moveFeature, reorder, decode, encode, History } from '../dist/model.js';
test('river geometry and lore survive saving and restoring', () => {
 const river = {...createFeature('river', [[1,2],[8,12]]),name:'Willow River',lore:'An old trading route.'};
 const state = {version:1,title:'Our world',features:[river]};
 assert.deepEqual(decode(encode(state)),state);
});
test('moving an object preserves its shape and leaves the original untouched',()=>{
 const f=createFeature('road',[[1,2],[8,12]]);const m=moveFeature(f,10,-4);
 assert.deepEqual(m.points,[[11,-2],[18,8]]);assert.deepEqual(f.points,[[1,2],[8,12]]);
});
test('stacking changes only the requested object order',()=>{
 const a={id:'a'},b={id:'b'},c={id:'c'};
 assert.deepEqual(reorder([a,b,c],'a',1),[b,a,c]);
 assert.deepEqual(reorder([a,b,c],'c',1),[a,b,c]);
});
test('undo and redo restore editing transactions',()=>{
 const h=new History({features:[]});h.push({features:[{id:'village'}]});
 assert.deepEqual(h.undo(),{features:[]});assert.deepEqual(h.redo(),{features:[{id:'village'}]});
 h.undo();h.push({features:[{id:'forest'}]});assert.equal(h.canRedo,false);
});
test('invalid or future-format saves are rejected instead of replacing work',()=>{
 for(const v of ['{bad','{}','{"version":2,"features":[]}',JSON.stringify({version:1,title:'x',features:[{type:'river',points:[[NaN,1]]}]})])assert.throws(()=>decode(v));
});
