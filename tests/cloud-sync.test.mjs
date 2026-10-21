import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/cloud-sync.js';
const {diff,apply}=globalThis.AcontecSync;

test('one changed product sends only its record and preserves unrelated remote changes',()=>{
  const base={products:[{id:'a',price:10},{id:'b',price:20}],cfg:{cur:'C$'}};
  const local=structuredClone(base);local.products[0].price=11;
  const remote=structuredClone(base);remote.products[1].price=22;
  const changes=diff(base,local);
  assert.equal(changes.length,1);assert.equal(changes[0].id,'a');
  const result=apply(remote,changes);
  assert.deepEqual(result.conflicts,[]);
  assert.deepEqual(result.data.products,[{id:'a',price:11},{id:'b',price:22}]);
  assert.equal(base.products[0].price,10);
});
test('overlapping edits require a decision without modifying the input',()=>{
  const base={products:[{id:'a',price:10}]},local={products:[{id:'a',price:11}]},remote={products:[{id:'a',price:12}]};
  const changes=diff(base,local),result=apply(remote,changes);
  assert.deepEqual(result.conflicts,[{key:'products',id:'a'}]);
  assert.equal(result.data.products[0].price,12);
  assert.equal(apply(remote,changes,true).data.products[0].price,11);
  assert.equal(local.products[0].price,11);
});
test('record insertions and deletions are repeatable',()=>{
  const base={products:[{id:'a',price:10}]},next={products:[{id:'b',price:20}]};
  const changes=diff(base,next),once=apply(base,changes);
  assert.deepEqual(once.data,next);
  assert.deepEqual(apply(once.data,changes),{data:next,conflicts:[]});
});
test('deleting a record edited remotely does not silently delete it',()=>{
  const changes=diff({products:[{id:'a',price:10}]},{products:[]});
  const result=apply({products:[{id:'a',price:12}]},changes);
  assert.equal(result.conflicts.length,1);assert.equal(result.data.products.length,1);
});
test('Postgres object key order does not cause false conflicts',()=>{
  const changes=diff({products:[{id:'a',price:10}]},{products:[{id:'a',price:11}]});
  assert.deepEqual(apply({products:[{price:10,id:'a'}]},changes).conflicts,[]);
  assert.deepEqual(diff({cfg:{cur:'C$',name:'A'}},{cfg:{name:'A',cur:'C$'}}),[]);
});
test('account codes are stable record identifiers',()=>{
  const changes=diff({accounts:[{code:'1101',name:'Caja'}]},{accounts:[{code:'1101',name:'Caja general'}]});
  assert.equal(changes[0].id,'1101');assert.equal(apply({accounts:[{code:'1101',name:'Caja'}]},changes).data.accounts[0].name,'Caja general');
});
test('malformed changes and prototype keys are rejected',()=>{
  for(const changes of [[{key:'__proto__',before:null,after:{admin:true}}],[{key:'products',id:'a',before:null,after:{id:'b'}}],[{key:'products'}]])assert.throws(()=>apply({},changes));
  assert.equal({}.admin,undefined);
});
test('edits made while an acknowledgement is lost survive rebasing',()=>{
  const snapshot={products:[{id:'a',price:11},{id:'b',price:20}]};
  const latestLocal=structuredClone(snapshot);latestLocal.products[0].price=12;
  const latestCloud=structuredClone(snapshot);latestCloud.products[1].price=21;
  const result=apply(latestCloud,diff(snapshot,latestLocal));
  assert.deepEqual(result.conflicts,[]);
  assert.deepEqual(result.data.products,[{id:'a',price:12},{id:'b',price:21}]);
});
