// Platform tests: actual operation, access/update and storage verification, with a simulated SQL boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import * as codec from '../netlify/lib/accounting-codec.mjs';
import {branchAccess,scopeBranch,mergeBranch,materializeBranches,companyBranches} from '../netlify/lib/branches.mjs';
import {accountingEntries} from '../netlify/lib/accounting-engine.mjs';
import {OPERATION_ARRAYS,operatorId} from '../netlify/lib/policies.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))).replaceAll('export ','');
const accessSource=read('netlify/lib/access.mjs'),storageSource=read('netlify/lib/accounting-storage.mjs');
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status})};

function harness(flag,historicalFlag){
 const id='11111111-1111-4111-8111-111111111111';
 let company={id,ownerEmail:'owner@example.invalid',revision:4,allowNegativeValues:flag,data:{cfg:{cur:'C$'},accounts:[],products:[],entries:[],shifts:[]}};
 let converted=codec.normalizeDocument(id,company.data),rows=structuredClone(converted.rows);
 let extra=structuredClone(converted.extra),hash=converted.hash;
 if(historicalFlag!==undefined){company.data.cfg.allowNegativeValues=historicalFlag;extra.cfg.allowNegativeValues=historicalFlag;hash=codec.historicalDocumentHash(company.data)}
 let state={companyId:id,mode:'relational',revision:4,manifest:converted.manifest,documentExtra:extra,sourceHash:hash};
 const companyTable={id:'id',ownerEmail:'ownerEmail',archivedAt:'archivedAt',updatedAt:'updatedAt'},stateTable={companyId:'companyId'};
 const users={},auditEvents={};
 const client={
  select(){return {from(table){this.table=table;return this},where(){return this},for(){return this},orderBy(){return this},then(resolve){resolve(this.table===companyTable?[structuredClone(company)]:this.table===users?[{platformAdmin:false}]:[])}}},
  update(table){return {set(patch){this.patch=patch;return this},where(){if(table===stateTable)state={...state,...this.patch};return this},returning(){company={...company,...this.patch};return Promise.resolve([structuredClone(company)])}}},
 };
 const noOp=()=>{},sql=()=>'',context={...codec,structuredClone,performance,Date,console,randomUUID,createHash,companyBranches,branchAccess,scopeBranch,mergeBranch,materializeBranches,
  companies:companyTable,users,auditEvents,schema:{accountingStorage:stateTable},getTableColumns:()=>({data:1}),eq:noOp,and:noOp,isNull:noOp,sql,
  internalTestApplies:()=>false,requireBilling:async()=>({plan:{id:'pro',limits:{}},ent:{access:true}}),adminEmail:()=>'',accessError:fail,
  tables:Object.fromEntries(Object.keys(rows).map(k=>[k,{}])),storedRows:async()=>structuredClone(rows),storageState:async()=>structuredClone(state),
  writeRows:async(_client,_company,next,previous)=>{assert.ok(previous);rows=structuredClone(next.rows)},
  db:{transaction:callback=>callback(client)},checkpoint:async()=>[],audit:async()=>{},syncBarcodes:async()=>{},dataChanges:()=>[],
  equal:(a,b)=>codec.canonical(a)===codec.canonical(b),REVIEW_OPS:[],CROSS_BRANCH_OPS:[],guardRoleChanges:noOp,
  projectData:(data,access)=>codec.operationalDocument(data,access.company.allowNegativeValues),
 };
 for(const name of ['guardFifoMutation','guardTreasury','guardBankReconciliations','guardPersonnel','guardAuditHistory','guardServicePayroll','guardPeriods','guardWorkflows'])context[name]=noOp;
 const ctx=vm.createContext(context);
 vm.runInContext(section(storageSource,'export async function verifyStored','// Caller holds'),ctx);
 vm.runInContext(section(storageSource,'export async function readAccounting','async function writeRows'),ctx);
 vm.runInContext(section(storageSource,'export async function syncAccounting','export async function returnToLegacy'),ctx);
 vm.runInContext(section(accessSource,'export async function companyAccess','export function entryModule'),ctx);
 vm.runInContext(section(accessSource,'export async function updateCompany','export function validatePermissions'),ctx);
 // Only database and unrelated feature boundaries are replaced. openShift and guardCash run unchanged.
 const operationSource=read('netlify/lib/operations.mjs').replace(/^import .*;\n/gm,'').replaceAll('export ','');
 const operationContext={...codec,structuredClone,Date,console,randomUUID,createHash,OPERATION_ARRAYS,operatorId,accountingEntries,
  updateCompany:ctx.updateCompany,companyAccess:ctx.companyAccess,db:context.db,scopeBranch,companyBranches,
  actorName:session=>session.email,accessError:fail,requireModule:()=>{},allowed:()=>true,equal:context.equal,handlesAdvanced:()=>false,
  fifoEnabled:()=>false,guardFifoOperation:noOp,applyFifo:noOp,commerceReservationsValid:noOp,validateBusinessRecords:noOp,
  validateConfiguredServices:noOp,validateEconomicSector:noOp,getStore:()=>({delete:async()=>{}}),
 };
 for(const name of new Set(operationSource.match(/\b[A-Z][A-Z_]*_OPS\b/g)))operationContext[name]=[];
 const operationVm=vm.createContext(operationContext);vm.runInContext(operationSource,operationVm);
 return {id,run:body=>operationVm.runOperation(id,{email:company.ownerEmail,activeBranchId:'principal'},body),
  company:()=>structuredClone(company),state:()=>structuredClone(state),verify:()=>ctx.readAccounting(client,company)};
}
for(const flag of [false,true])for(const historicalFlag of [undefined,false,true])test(`apertura relacional guarda con opción ${flag} y campo histórico ${historicalFlag}`,async()=>{
 const h=harness(flag,historicalFlag);
 const result=await h.run({operation:'openShift',revision:4,date:'2026-11-09',opening:0,source:'1101',reference:'T-1'});
 assert.equal(result.revision,5);assert.ok(result.id);assert.equal(h.company().data.shifts.length,1);
 assert.equal(Object.hasOwn(h.company().data.cfg,'allowNegativeValues'),false);
 assert.equal(Object.hasOwn(h.state().documentExtra.cfg,'allowNegativeValues'),false);
 assert.equal(result.data.cfg.allowNegativeValues,flag);
 assert.equal(h.state().sourceHash,codec.documentHash(h.company().data));
 await assert.doesNotReject(()=>h.verify());
 await assert.rejects(()=>h.run({operation:'openShift',revision:4,date:'2026-11-09',opening:0,source:'1101'}),/otra pestaña/);
});
test('acepta solo diferencias en la opción y rechaza corrupción contable o huella ajena',()=>{
 const source={cfg:{cur:'C$',allowNegativeValues:true},entries:[],products:[]};
 const clean=codec.accountingDocument(source);
 assert.doesNotThrow(()=>codec.verifySourceDocuments(source,clean,codec.historicalDocumentHash(source)));
 assert.doesNotThrow(()=>codec.verifySourceDocuments(source,clean,codec.documentHash(clean)));
 const corrupt=structuredClone(clean);corrupt.cfg.cur='USD';
 assert.throws(()=>codec.verifySourceDocuments(source,corrupt,codec.historicalDocumentHash(source)),/integridad/);
 assert.throws(()=>codec.verifySourceDocuments(source,clean,'unrelated'),/integridad/);
 assert.equal(source.cfg.allowNegativeValues,true);
});
