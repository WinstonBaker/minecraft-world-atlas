import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFeature,TYPES} from '../dist/model.js';
import {renderFeature,bounds} from '../dist/render.js';
for(const type of TYPES)test(`${type} renders only the points drawn by the user`,()=>{
 const feature=createFeature(type,[[10,20],[90,30],[40,80]]);
 const markup=renderFeature(feature,false);
 assert.match(markup,/d="M10 20 L90 30 L40 80"/);
 assert.doesNotMatch(markup,/<use|<image|<symbol|<ellipse/);
 assert.deepEqual(bounds(feature),{x:2,y:12,w:96,h:76});
});
test('a click is rendered as a plain ink dot, including old single-point features',()=>{
 const f=createFeature('forest',[[12,24]]);const markup=renderFeature(f,false);
 assert.match(markup,/<circle[^>]*cx="12"[^>]*cy="24"/);assert.doesNotMatch(markup,/<use|<image|<symbol/);
});
