import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import '../public/invoice-design.js';
import { roleAllows } from '../netlify/lib/policies.mjs';
import { DEFAULT_PLANS, moduleIncluded } from '../netlify/lib/billing-rules.mjs';
const design=globalThis.AcontecInvoiceDesign;
const initial={...design.defaults({},'Empresa original'),ruc:'RUC-original'};
const changed={...initial,legalName:'Empresa nueva',ruc:'RUC-nuevo',copies:2};
const cfg={print:{...changed,legacyInvoiceIds:['histórica'],versions:[{id:'inicial',at:'0001-01-01T00:00:00.000Z',settings:initial},{id:'nueva',at:'2026-10-30T12:00:00.000Z',settings:changed}]}};

test('conserva los siete campos previos y metadatos desconocidos sin reemplazar textos vacíos',()=>{
 const saved={format:'letter',address:'Dirección anterior',phone:'2222',email:'a@b.ni',creditTerms:'30 días',legalText:'',thanks:'Gracias anteriores',custom:'Conservar'};
 const result=design.settings({print:saved,pos:{logo:'/api/image?key=abcd.webp'},ruc:'RUC'},'Empresa');
 for(const [key,value] of Object.entries(saved))assert.equal(result[key],value);
 assert.equal(result.logo,'/api/image?key=abcd.webp');assert.equal(result.showAcontec,true);
 assert.equal(Object.hasOwn(result,'versions'),false);
});
test('facturas históricas conservan la configuración inicial incluso el día del primer cambio',()=>{
 assert.equal(design.resolve(cfg,'Nombre actual',{id:'histórica',date:'2026-10-30'}).ruc,'RUC-original');
});
test('reimpresión usa referencia de versión y fecha de emisión sin tomar los datos fiscales actuales',()=>{
 assert.equal(design.resolve(cfg,'Otro nombre',{printVersionId:'inicial',issuedAt:'2026-11-10T12:00:00.000Z'}).legalName,'Empresa original');
 assert.equal(design.resolve(cfg,'Otro nombre',{issuedAt:'2026-10-30T11:00:00.000Z'}).ruc,'RUC-original');
 assert.equal(design.resolve(cfg,'Otro nombre',{issuedAt:'2026-10-30T13:00:00.000Z'}).ruc,'RUC-nuevo');
 assert.equal(design.resolve(cfg,'Otro nombre',{date:'2026-10-29'}).ruc,'RUC-original');
});
test('todos los planes incluyen diseño y los roles solo lo reciben por permiso explícito',async()=>{
 const source=await readFile(new URL('../netlify/lib/access.mjs',import.meta.url),'utf8');
 const fragment=source.slice(source.indexOf('export const allowed ='),source.indexOf('export const allData =')).replace('export ','');
 const allowed=vm.runInNewContext(fragment+';allowed',{roleAllows,moduleIncluded});
 for(const plan of DEFAULT_PLANS)assert.equal(moduleIncluded(plan,'diseno_factura'),true);
 for(const role of ['cajero','vendedor','supervisor','contador','observador']){
  const access={member:{role},permissions:{},billingPlan:DEFAULT_PLANS[0]};
  assert.equal(allowed(access,'diseno_factura'),false);
  access.permissions.diseno_factura='lectura';assert.equal(allowed(access,'diseno_factura'),true);assert.equal(allowed(access,'diseno_factura',true),false);
  access.permissions.diseno_factura='escritura';assert.equal(allowed(access,'diseno_factura',true),true);
  assert.equal(allowed({...access,support:true},'diseno_factura',true),false);
 }
});
test('valida tipos, longitudes y enumeraciones del servidor sin truncar silenciosamente',async()=>{
 const source=await readFile(new URL('../netlify/lib/operations.mjs',import.meta.url),'utf8');
 const fragment=source.slice(source.indexOf('function validatePrintSettings('),source.indexOf('function appendEntry('));
 const validate=vm.runInNewContext(fragment+';validatePrintSettings',{invoiceDesign:design,requireValue:(ok,message)=>{if(!ok)throw new Error(message)},dateValue:value=>value});
 for(const [key,[,max]] of Object.entries(design.fields))assert.throws(()=>validate({[key]:'x'.repeat(max+1)},initial),key);
 for(const bad of [{copies:3},{copies:1.5},{logoSize:181},{format:'html'},{accent:'red;display:none'},{logo:'javascript:alert(1)'},{showAcontec:'false'},{showCode:0},{website:'javascript:alert(1)'},{printerBooks:'-1'}])assert.throws(()=>validate(bad,initial));
 assert.equal(validate({thanks:'',copies:2},initial).thanks,'');
});
test('original y copia se imprimen con sello, fiscalidad, logo seguro y texto escapado',async()=>{
 const source=await readFile(new URL('../public/experience.js',import.meta.url),'utf8');
 const fragment=source.slice(source.indexOf('function invoiceSettings('),source.indexOf('// El selector'));
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const render=vm.runInNewContext(fragment+';invoiceMarkup',{AcontecInvoiceDesign:design,S:{cfg,entries:[]},CO:{name:'Empresa'},esc:escape,r2:n=>Math.round(n*100)/100,operationalRound:n=>Math.round(n*100)/100,customerById:()=>null,prod:()=>null,invoiceDate:v=>v||'',invoiceOperator:()=>'<Cajero>',saleStatus:()=> 'ANULADA',money:n=>'C$ '+n,formatQuantity:n=>n,printAmountWords:()=> 'Monto en letras',paymentLabels:{},PAY:{}});
 const settings={...changed,title:'<script>no</script>',notes:'<img src=x onerror=alert(1)>',showCode:false,showUnit:false,showDiscount:false,showCustomerName:false,showCustomerTaxId:false,logo:'javascript:alert(1)'};
 const html=render({type:'venta',date:'2026-10-30',total:10,items:[{name:'<Producto>',q:1,u:10}],customer:{name:'Cliente privado',taxId:'ID-privado'}},'a4','color',settings);
 assert.equal((html.match(/class="invoice-annulled"/g)||[]).length,2);
 assert.match(html,/Original: cliente/);assert.match(html,/Copia: emisor/);
 assert.equal((html.match(/DOCUMENTO NO FISCAL — SIN AUTORIZACIÓN DGI/g)||[]).length,2);
 assert.equal((html.match(/Sistema Acontec/g)||[]).length,2);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;Producto&gt;/);
 for(const forbidden of ['<script>','<img src=x','javascript:','Cliente privado','ID-privado','<th>Código</th>','<th>Unidad</th>','<th class="n">Descuento</th>'])assert.equal(html.includes(forbidden),false,forbidden);
});

test('el historial no se rota ni pierde configuraciones al normalizar el documento relacional',async()=>{
 const {normalizeDocument,restoreDocument}=await import('../netlify/lib/accounting-codec.mjs');
 const document={cfg:structuredClone(cfg),accounts:[],entries:[],products:[],customers:[]};
 const restored=restoreDocument(normalizeDocument('11111111-1111-4111-8111-111111111111',document));
 assert.deepEqual(restored,document);
 assert.equal(design.resolve(restored.cfg,'Nombre actual',{id:'histórica'}).ruc,'RUC-original');
});
