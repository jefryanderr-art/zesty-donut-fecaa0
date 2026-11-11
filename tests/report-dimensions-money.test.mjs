import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const reporting=await readFile(new URL('../public/reporting.js',import.meta.url),'utf8');
function context(){const c=vm.createContext({S:{cfg:{cur:'C$'},entries:[],accounts:[{code:'1101',nat:'D'}]},r2:n=>Math.round((+n||0)*100)/100,esc:s=>String(s).replaceAll('<','&lt;'),V:{},MAY:'1101',AcontecAnnualLedger:{select:e=>e},rg:()=>['2026-01-02','2026-12-31'],uiT:(_,s)=>s,pageHead:()=>'',pbtn:()=>'',pbar:()=>'',accOpts:()=>'',notice:x=>x,main:x=>{c.html=x},primaryBranches:()=>c.branches,branches:[{id:'principal',name:'Principal'}],renderRows:(headers,rows,render)=>{c.headers=headers;return rows.map(render).join('')}});vm.runInContext(app.slice(app.indexOf('const moneyValue='),app.indexOf('const tshow='))+';globalThis.format=money2;globalThis.textMoney=money;',c);return c}
test('formato monetario central: signo, color, cero redondeado y monedas',()=>{
 const c=context();
 assert.match(c.format(1234),/>C\$ 1,234.00<\/span>/);assert.doesNotMatch(c.format(1234),/negative-value/);
 assert.match(c.format(-1234),/class="negative-value">-C\$ 1,234.00/);
 for(const value of [0,-0,-0.004,0.004]){assert.equal(c.textMoney(value),'C$ 0.00');assert.doesNotMatch(c.format(value),/negative-value|>-|\(/)}
 for(const cur of ['US$','€','NIO']){c.S.cfg.cur=cur;assert.equal(c.textMoney(-1234.5),'-'+cur+' 1,234.50')}
 c.S.cfg.cur='<moneda>';assert.match(c.format(-1),/&lt;moneda>/);
});
test('Mayor alterna columnas sin cambiar saldo inicial ni saldo corrido',()=>{
 const c=context();c.S.entries=[{id:'old',date:'2026-01-01',lines:[{a:'1101',d:100,c:0}]},{id:'new',date:'2026-01-02',lines:[{a:'1101',d:0,c:150}]}];
 vm.runInContext(reporting.slice(reporting.indexOf('const dimensionsEnabled='),reporting.indexOf('const analyticModal='))+reporting.slice(reporting.indexOf('V.mayor=')),c);
 c.V.mayor();const base=c.html;assert.equal(c.headers.includes('Centro / proyecto'),false);assert.equal(c.headers.includes('Sucursal'),false);assert.match(base,/-C\$ 50.00/);
 c.S.cfg.pos={useDimensions:true};c.V.mayor();assert.equal(c.headers.includes('Centro / proyecto'),true);assert.match(c.html,/-C\$ 50.00/);
 c.S.cfg.pos.useDimensions=false;c.S.entries[0].project='Histórico';c.V.mayor();assert.equal(c.headers.includes('Centro / proyecto'),true);
 c.branches.push({id:'segunda',name:'Segunda'});c.V.mayor();assert.equal(c.headers.includes('Sucursal'),true);assert.match(c.html,/C\$ 100.00/);assert.match(c.html,/-C\$ 50.00/);
});
test('Excel mantiene negativos numéricos y un formato rojo con signo explícito',async()=>{
 const c=context(),source=await readFile(new URL('../public/imports.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('const spreadsheetMoneyFormat='),source.indexOf('ACT.exportSpreadsheet='))+';globalThis.cellValue=spreadsheetCellValue;globalThis.formatSheet=formatSpreadsheetNumbers;',c);
 const cell=text=>({querySelector:()=>null,textContent:text});assert.equal(c.cellValue(cell('-C$ 1,234.00')),-1234);assert.equal(c.cellValue(cell('C$ 0.00')),0);assert.equal(c.cellValue(cell('1101')),'1101');
 const sheet=c.formatSheet({A1:{t:'n',v:-1234},B1:{t:'s',v:'Cuenta'}});assert.equal(sheet.A1.v,-1234);assert.match(sheet.A1.z,/\[Red\]-/);assert.equal(sheet.B1.z,undefined);
});
