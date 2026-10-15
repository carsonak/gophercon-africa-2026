import test from 'node:test';
import assert from 'node:assert/strict';
import { distance, median, diverse, discover, initialContext } from '../assets/js/discovery.mjs';
const r = (id, lat = 0, lng = 0, extra = {}) => ({ id: String(id), lat, lng, species: `species-${id}`, countryCode: 'KE', temperature: 25, ...extra });
const rng = () => .3;
test('great-circle distances handle poles, equal points, and date line', () => {
 assert.equal(distance(r(1), r(2)), 0);
 assert.ok(Math.abs(distance(r(1,0,0), r(2,0,90)) - 10007.54) < 1);
 assert.ok(distance(r(1,0,179), r(2,0,-179)) < 223);
 assert.ok(Number.isFinite(distance(r(1,90,0), r(2,-90,0))));
});
test('temperature median ignores unavailable values', () => {
 assert.equal(median([30, 10, 20, NaN]), 20);
 assert.equal(median([10,20]), 15);
 assert.equal(median([]), null);
});
test('stack favours species diversity and excludes previous photos when possible', () => {
 const records = Array.from({length: 12}, (_, i) => r(i,0,0,{species: i < 6 ? 'old' : 'new'}));
 const ordered = diverse(records, records.slice(0,6));
 assert.ok(ordered.slice(0,6).every(x => Number(x.id) >= 6));
 assert.equal(new Set(ordered.map(x=>x.id)).size,12);
 assert.equal(new Set(diverse(Array.from({length:10},(_,i)=>r(i))).slice(0,6).map(x=>x.species)).size,6);
});
test('near me orders by distance and reports sparse coverage', () => {
 const records = [r(1,0,90),r(2,0,1),r(3,0,40),r(4,0,2),r(5,0,50),r(6,0,70)];
 const result = discover({records,mode:'near',home:{lat:0,lng:0}});
 assert.deepEqual(result.records.map(x=>x.id),['2','4','3','5','6','1']);
 assert.equal(result.extent,Infinity);
});
test('near me uses the smallest supported radius with six observations', () => {
 const records=Array.from({length:8},(_,i)=>r(i,0,i*.1));
 assert.equal(discover({records,mode:'near',home:{lat:0,lng:0}}).extent,250);
});
test('country fallback stays within country and missing home needs location', () => {
 const records=[r(1),r(2,0,0,{countryCode:'AU'})];
 const result=discover({records,mode:'near',home:{countryCode:'AU'},random:rng});
 assert.deepEqual(result.records.map(x=>x.id),['2']); assert.equal(result.extent,'country');
 assert.equal(discover({records,mode:'near'}).needsLocation,true);
});
test('world journeys choose distant countries; sparse fallback is farthest', () => {
 const records=[r(1),r(2,0,80,{countryCode:'AU'}),r(3,0,1)];
 const current=initialContext([records[0]]);
 assert.equal(discover({records,current,mode:'world',random:rng}).destination.id,'2');
 assert.equal(discover({records:[records[0],records[2]],current,mode:'world',random:rng}).destination.id,'3');
});
test('climate, aquatic, and different-species rules persist across full result pools', () => {
 const current=initialContext([r(1,0,0,{species:'lion',temperature:25})]);
 const records=[...current.records,r(2,0,0,{species:'lion',temperature:0}),r(3,0,1,{aquatic:true,temperature:5}),r(4,0,0,{temperature:24})];
 const climate=discover({records,current,mode:'climate',random:rng});
 assert.ok(climate.records.every(x=>Math.abs(x.temperature-25)>=10));
 assert.equal(climate.referenceTemperature,25);
 assert.ok(discover({records,current,mode:'water',random:rng}).records.every(x=>x.aquatic));
 assert.ok(discover({records,current,mode:'different',random:rng}).records.every(x=>x.species!=='lion'));
});
test('empty pools, broken photos, and exhausted filters return explainable errors', () => {
 const records=[r(1)]; const current=initialContext(records);
 assert.ok(discover({records:[],mode:'world'}).error);
 assert.ok(discover({records,mode:'world',broken:new Set(['1'])}).error);
 assert.ok(discover({records,current,mode:'climate'}).error);
 assert.ok(discover({records,current,mode:'water'}).error);
 assert.ok(discover({records,current,mode:'different'}).error);
 assert.equal(current.records[0].id,'1');
});
test('location jumps use the selected point and include other species', () => {
 const records=[r(1,0,0),r(2,0,.1),r(3,40,80)];
 const result=discover({records,mode:'location',destination:records[0],random:rng});
 assert.equal(result.destination.id,'1');
 assert.equal(result.records.length,3);
});
