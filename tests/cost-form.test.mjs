import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/operations.js',import.meta.url),'utf8');
function harness(catalog=[]){
 const forms=[],timers=[],requests=[],host={replaceChildren(shell){this.shell=shell}},context={ACT:{},S:{costCatalog:catalog,accounts:[],pettyFunds:[],entries:[],businessRecords:[],customers:[],products:[]},CO:{id:'company',branchId:'principal'},COST_MONTH:'2026-02',today:()=> '2026-02-01',view(){},setTimeout:f=>timers.push(f),$:()=>host,notice:s=>s,esc:s=>String(s),uiT:(k,s)=>s,field:()=>'',selectField:()=>'',option:(id,label)=>`<option value="${id}">${label}</option>`,accOpts:()=>'',amountField:()=>'',supplierFields:()=>'',documentFileField:()=>'',formAttachment:async f=>f.attachment,primaryBranches:()=>[{id:'principal',name:'Principal'}],v:(f,k)=>f.elements[k].value};
 context.modal=(title,html,submit)=>{
  const names=['name','date','reference','catalogId','account','type','direct','center','notes','base','vatRate','supplierId','party','pay','fundId','due','allocation','allocationId','amount','startMonth','recurring','active'];
  const elements=Object.fromEntries(names.map(k=>{const label={hidden:false};return [k,{value:'',checked:true,closest:()=>label}]}));
  Object.assign(elements.pay,{value:'1101'});Object.assign(elements.date,{value:'2026-02-01'});Object.assign(elements.startMonth,{value:'2026-02'});Object.assign(elements.type,{value:'fijo'});Object.assign(elements.direct,{value:'false'});elements.amount.value='0';
  const shell={title},err={textContent:''},buttons={};const f={elements,html,submit,shell,closest:()=>shell,querySelector:s=>s==='.err'?err:(buttons[s]||={addEventListener:(kind,fn)=>buttons[s].click=fn})};forms.push(f);return f;
 };
 context.operate=async(op,body)=>{requests.push({op,body});if(op==='costCatalog'){context.S.costCatalog.push({...body,id:'new'});}return {id:'new'};};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function costCatalogForm('),source.indexOf('ACT.newCostCatalog='))+source.slice(source.indexOf('ACT.recordCost='),source.indexOf('ACT.reverseCost=')),context);
 return {context,forms,timers,requests,host};
}
test('catálogo vacío ofrece creación y selección explícita; pago controla vencimiento y fondo',()=>{const h=harness();h.context.ACT.recordCost();const f=h.forms[0];assert.match(f.html,/catálogo está vacío/);assert.match(f.html,/Crear costo nuevo/);assert.equal(f.elements.catalogId.required,true);assert.equal(f.elements.due.required,false);f.elements.pay.value='2101';f.elements.pay.onchange();assert.equal(f.elements.due.required,true);assert.equal(f.elements.due.closest().hidden,false);f.elements.pay.value='petty';f.elements.pay.onchange();assert.equal(f.elements.due.required,false);assert.equal(f.elements.fundId.required,true)});
test('creación inline conserva formulario y adjunto y precarga el costo recién creado',async()=>{const h=harness();h.context.ACT.recordCost();const original=h.forms[0];original.elements.reference.value='Factura conservada';original.attachment={name:'recibo.pdf'};original.elements.catalogId.value='__new__';original.elements.catalogId.onchange();const catalog=h.forms[1];catalog.elements.name.value='Fletes';catalog.elements.account.value='6104';catalog.elements.type.value='variable';catalog.elements.direct.value='true';catalog.elements.center.value='Ventas';catalog.elements.amount.value='50';await catalog.submit(catalog);h.timers.forEach(fn=>fn());assert.equal(h.host.shell,original.shell);assert.equal(original.elements.reference.value,'Factura conservada');assert.equal(original.attachment.name,'recibo.pdf');assert.equal(original.elements.catalogId.value,'new');assert.equal(original.elements.account.value,'6104');assert.equal(original.elements.center.value,'Ventas');assert.equal(original.elements.direct.value,'true');assert.equal(original.elements.base.value,'50')});
