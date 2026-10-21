import { randomUUID } from 'node:crypto';
import { balancedLines, moneyCents } from './accounting-engine.mjs';
const NAT={activo:'D',gasto:'D',costo:'D',pasivo:'C',patrimonio:'C',ingreso:'C'};
export function importRecords(data,access,session,body,h){
 const {requireValue:check,requirePermission:permit,appendEntry:append,dateValue:date,validateSupplier}=h,kind=body.kind,types={products:'inventario',customers:'ventas',suppliers:'proveedores',accounts:'contabilidad',opening:'contabilidad'};
 check(types[kind],'Tipo de importación inválido.');permit(access,types[kind]);check(body.confirmed===true&&Array.isArray(body.records)&&body.records.length>0&&body.records.length<=1000,'Confirma entre 1 y 1,000 filas.');const when=date(body.date);
 const string=(value,max=200)=>String(value??'').trim().slice(0,max),money=value=>{const n=value===''||value===undefined?0:Number(value);check(n>=0&&n<=999999999,'Importe inválido.');return moneyCents(n)/100},quantity=value=>{const n=value===''||value===undefined?0:Number(value);check(Number.isFinite(n)&&n>=0&&n<=1e9&&Math.abs(n*1e6-Math.round(n*1e6))<1e-5,'Cantidad inválida.');return n};
 const opening=[];for(let index=0;index<body.records.length;index++){
  try{const row=body.records[index];check(row&&typeof row==='object'&&!Array.isArray(row),'Fila inválida.');
   if(kind==='products'){
    const code=string(row.codigo,80),name=string(row.nombre);check(name&&(!code||!data.products.some(p=>p.code===code)),'Nombre vacío o código de producto repetido.');const stock=quantity(row.existencia),cost=money(row.costo),price=money(row.precio),vatRate=Number(row.iva||0);check(Number.isFinite(vatRate)&&vatRate>=0&&vatRate<=100,'IVA inválido.');const product={id:randomUUID(),name,code,cost,price,stock,unit:string(row.unidad||'unidad',40),min:quantity(row.minimo),vatRate,barcodes:string(row.codigos_barras,3900).split('|').map(c=>c.trim()).filter(Boolean)};data.products.push(product);
    if(stock){const total=Math.round(stock*cost*100)/100;append(data,session,{date:when,type:'invini',desc:'Inventario inicial importado · '+name,total,stock:[{pid:product.id,q:stock,unit:product.unit,unitCost:cost}],lines:total?[{a:'1301',d:total,c:0},{a:'3101',d:0,c:total}]:[]})}
   }else if(kind==='accounts'){
    const code=string(row.codigo,40),name=string(row.nombre),tipo=string(row.tipo,30),nat=string(row.naturaleza||NAT[tipo],1).toUpperCase();check(/^[0-9][0-9-]{1,39}$/.test(code)&&name&&NAT[tipo]&&['D','C'].includes(nat)&&!data.accounts.some(a=>a.code===code),'Cuenta inválida o ya existente.');const sub=string(row.subtipo,20);check(['','ef','fijo','fin'].includes(sub),'Subtipo inválido.');data.accounts.push({code,name,tipo,nat,sub});
   }else if(kind==='opening'){opening.push({a:string(row.cuenta,40),d:money(row.debe),c:money(row.haber)})}
   else{
    const name=string(row.nombre),taxId=string(row.ruc,80),phone=string(row.telefono,80),email=string(row.correo,254),address=string(row.direccion,1000);check(name&&(!taxId||!data[kind].some(r=>r.taxId?.toLowerCase()===taxId.toLowerCase())),'Nombre vacío o RUC repetido.');check(!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Correo inválido.');
    if(kind==='customers')data.customers.push({id:randomUUID(),name,taxId,phone,email,address,contact:'',seller:'',currency:data.cfg.cur||'C$',notes:'',paymentType:'contado',status:'activo',creditDays:30,creditLimit:0});
    else data.suppliers.push(validateSupplier(data,{name,taxId,phone,email,address,contact:'',seller:'',currency:data.cfg.cur||'C$',notes:'',paymentType:'contado',active:true,creditDays:30,creditLimit:0}));
   }
  }catch(error){const message='Fila '+(index+2)+': '+(error.publicMessage||error.message);check(false,message)}
 }
 if(kind==='opening'){const lines=balancedLines(opening,data.accounts);check(!lines.some(l=>['1104','2107'].includes(l.a)||l.a.startsWith('1103-')),'Los saldos de turnos y caja chica se registran desde sus módulos.');append(data,session,{date:when,type:'apertura-importada',desc:'Saldos iniciales importados',reference:String(body.reference||'IMPORTACION').slice(0,200),total:lines.reduce((s,l)=>s+l.d,0),lines})}
 return body.records.length;
}
