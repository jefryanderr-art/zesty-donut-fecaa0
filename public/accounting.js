'use strict';

const EXTRA_ACCOUNTS=[
  ['3191','Diferencias de inventario por corrección','patrimonio','C',''],
  ['1202','IVA acreditable / por cobrar','activo','D',''],
  ['1203','Préstamos a empleados','activo','D',''],
  ['2104','Retenciones de nómina por pagar','pasivo','C',''],
  ['2105','Seguro social por pagar','pasivo','C',''],
  ['2106','IVA cobrado / por pagar','pasivo','C',''],
  ['6108','Impuesto sobre ganancias','gasto','D','']
];
const FISCAL_DEFAULTS={vatRate:0,incomeRate:0,salaryTax:0,socialRate:0,daysPerMonth:30,overtimeFactor:1,workingHours:8,bonusDays:0,premiumDays:0,vacationDays:0,dismissalDays:0,resignationDays:0,delimiter:';',decimal:'.',exportColumns:'concepto,periodo,vencimiento,base,tasa,iva_cobrado,iva_acreditable,monto,pagado,saldo,estado'};
function prepareAccounting(){
  S.cfg=S.cfg||{cur:'C$',ruc:'',addr:''};
  for(const name of ['employees','payrolls','taxes','properties','settlements','customers'])if(!Array.isArray(S[name]))S[name]=[];
  S.cfg.fiscal={...FISCAL_DEFAULTS,...S.cfg.fiscal};
  for(const [name,,maximum] of RULE_FIELDS){const value=Number(S.cfg.fiscal[name]);if(!Number.isFinite(value)||value<0||value>maximum||(['daysPerMonth','workingHours','overtimeFactor'].includes(name)&&value===0))S.cfg.fiscal[name]=FISCAL_DEFAULTS[name];else S.cfg.fiscal[name]=value}
  for(const [code,name,tipo,nat,sub] of [...EXTRA_ACCOUNTS,...ACC.filter(account=>['2102','2103','6101'].includes(account[0]))]){
    if(!S.accounts.some(account=>account.code===code))S.accounts.push({code,name,tipo,nat,sub});
    if(!PROT.includes(code))PROT.push(code);
  }
  for(const code of ['2102','2103','6101','6108'])if(!PROT.includes(code))PROT.push(code);
}
MENU[1][1].push(['kardex','📦','Cardex / Kardex'],['cobrar','↙','Cuentas por cobrar'],['pagar','↗','Cuentas por pagar']);
MENU.splice(2,0,['Personal',[['personal','👥','Expedientes de empleados'],['nomina','💰','Procesamiento de nómina'],['liquidaciones','⚖️','Liquidaciones y finiquitos'],['provisiones','🪙','Provisiones mensuales']]],['Fiscal',[['fiscal','🗓️','Agenda y obligaciones'],['impuestos','📊','IVA y renta anual'],['propiedades','🏢','Propiedades y tasas'],['reglas','⚙️','Reglas de cada empresa']]]);
const field=(name,label,value='',type='text',attrs='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const amountField=(name,label,value=0)=>field(name,label,value,'number','min="0" step="0.01" required');
const notice=text=>`<p class="accounting-notice">${esc(text)}</p>`;
const emptyRow=columns=>`<tr><td colspan="${columns}" class="mut empty-ledger">No hay registros. Usa el botón superior para comenzar.</td></tr>`;
const accountingTable=(headers,rows)=>`<div class="card"><div class="tw"><table><thead><tr>${headers.map(header=>`<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows||emptyRow(headers.length)}</tbody></table></div></div>`;
const actionButton=(action,id,label)=>`<button class="lk" data-a="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
const pageHead=(title,buttons='')=>`<div class="ph"><h2>${esc(title)}</h2><div class="accounting-actions">${buttons}</div></div>`;
const cashSelect=(name='cash')=>`<label>Cuenta de dinero<select name="${name}">${accOpts('1102',account=>['1101','1102'].includes(account.code))}</select></label>`;
const employeeOptions=id=>S.employees.filter(employee=>employee.active!==false||employee.id===id).map(employee=>`<option value="${esc(employee.id)}" ${employee.id===id?'selected':''}>${esc(employee.name)}</option>`).join('');
const invoicePayments=id=>S.entries.filter(entry=>entry.invoiceId===id);
const paidInvoice=id=>r2(invoicePayments(id).filter(entry=>entry.type==='abono'&&!S.entries.some(record=>record.reversalOf===entry.id)).reduce((total,entry)=>total+entry.total,0));
const invoicePrincipal=entry=>r2((entry.lines||[]).filter(line=>line.a===entry.pay).reduce((total,line)=>total+(entry.pay==='1201'?line.d-line.c:line.c-line.d),0));
const invoiceBalance=entry=>Math.max(0,r2(S.entries.filter(record=>record.id===entry.id||record.invoiceId===entry.id||record.reversalOf===entry.id).reduce((total,record)=>total+(record.lines||[]).filter(line=>line.a===entry.pay).reduce((sum,line)=>sum+(entry.pay==='1201'?line.d-line.c:line.c-line.d),0),0)));
const debtStatus=(balance,due)=>balance<=0?'Cancelada':due<today()?'Vencida':'Pendiente';
const badge=status=>`<span class="ledger-badge ${['Cancelada','Pagado','Saldo a favor','Sin deuda'].includes(status)?'paid':status==='Vencida'?'overdue':'pending'}">${esc(status)}</span>`;
function invoices(receivable){const account=receivable?'1201':'2101';return S.entries.filter(entry=>entry.pay===account&&entry.total>0&&entry.lines.some(line=>line.a===account&&(receivable?line.d>0:line.c>0)))}
function taxTotals(items){
  const subtotal=r2(items.reduce((total,item)=>total+r2(item.q*item.u),0));
  const vat=r2(items.reduce((total,item)=>total+r2(r2(item.q*item.u)*(item.vatRate||0)/100),0));
  return {subtotal,vat,total:r2(subtotal+vat)};
}
function invoiceForm(ex,sale){
  const title=sale?'venta':'compra';
  const form=modal(`${ex?'Editar':'Nueva'} ${title}`,field('dt','Fecha',ex?.date||today(),'date','required')+(sale?saleCustomerFields(ex):supplierFields(ex))+field('reference','Número de factura',ex?.reference||'','text','required')+field('due','Vencimiento (si es crédito)',ex?.due||ex?.date||today(),'date','required')+`<label>Forma de pago<select name="py">${payOpts(sale?'1201':'2101')}</select></label>`+notice('Los precios son sin IVA. Activa el IVA por producto solo cuando aplique; el porcentaje es configurable.')+`<div class="items">${(ex?.items?.length?ex.items:[{}]).map(item=>itemRow(item,true)).join('')}</div><div class="accounting-actions"><button type="button" class="lk" data-a="addItem">+ Agregar producto</button>${sale?'<button type="button" class="lk" data-a="printSale">Imprimir</button>':''}</div><div id="invoice-totals" class="accounting-notice" aria-live="polite"></div>`,form=>{
    const items=readItems(),pay=v(form,'py');
    const customer=sale?customerById(v(form,'customerId')):null;
    if(sale&&v(form,'customerId')&&!customer)return 'El cliente ya no está disponible. Selecciona otro o registra un nombre manual.';
    if(customer&&customer.status!=='activo'&&ex?.customerId!==customer.id)return 'Selecciona un cliente activo para esta venta.';
    if(!items.length||items.some(item=>!prod(item.p)||!Number.isFinite(item.q)||item.q<=0||!Number.isFinite(item.u)||item.u<0||!Number.isFinite(item.vatRate)||item.vatRate<0||item.vatRate>100))return 'Revisa los productos, cantidades, precios e IVA.';
    const totals=taxTotals(items);if(totals.total<=0)return 'El total debe ser mayor que cero.';
    if(ex&&invoicePayments(ex.id).length&&(pay!==ex.pay||totals.total<paidInvoice(ex.id)))return 'Esta factura tiene abonos: conserva la forma de pago y un total no menor a lo abonado.';
    if(pay===(sale?'1201':'2101')&&v(form,'due')<v(form,'dt'))return 'El vencimiento no puede ser anterior a la factura.';
    const changes=new Map();
    const changeFor=id=>{if(!changes.has(id))changes.set(id,{quantity:0,value:0});return changes.get(id)};
    for(const movement of ex?.stock||[])changeFor(movement.pid).quantity-=movement.q;
    if(!sale)for(const item of ex?.items||[])changeFor(item.p).value-=item.q*item.u;
    const previousCost=ex?.lines.filter(line=>line.a==='5101').reduce((total,line)=>total+line.d-line.c,0)||0;
    const previousWeighted=(ex?.items||[]).reduce((total,item)=>total+item.q*(prod(item.p)?.cost||0),0);
    for(const item of items){
      const previous=(ex?.items||[]).find(old=>old.p===item.p);
      item.unit=previous?(previous.unit||'unidad'):(prod(item.p).unit||'unidad');
      item.cost=sale?(previous?.cost??(previous&&previousWeighted>0?previousCost*(prod(item.p).cost/previousWeighted):prod(item.p).cost)):item.u;
      const change=changeFor(item.p);change.quantity+=sale?-item.q:item.q;if(!sale)change.value+=item.q*item.u;
    }
    const updates=[];
    for(const [id,change] of changes){
      const product=prod(id);if(!product)return 'Un producto de la factura ya no existe.';
      const quantity=quantityRound(product.stock+change.quantity);if(quantity<0)return `Existencia insuficiente de ${product.name}; quedaría en ${quantity}.`;
      const value=product.stock*product.cost+change.value;
      if(!sale&&value<-.01)return 'La edición dejaría una valoración negativa. Revisa los movimientos posteriores.';
      updates.push({product,quantity,cost:sale?product.cost:quantity>0?r2(Math.max(0,value)/quantity):product.cost});
    }
    const cost=r2(items.reduce((total,item)=>total+item.q*item.cost,0));
    const lines=sale?[{a:pay,d:totals.total,c:0},{a:'4101',d:0,c:totals.subtotal}]:[{a:'1301',d:totals.subtotal,c:0},{a:pay,d:0,c:totals.total}];
    if(totals.vat)lines.push(sale?{a:'2106',d:0,c:totals.vat}:{a:'1202',d:totals.vat,c:0});
    if(sale&&cost)lines.push({a:'5101',d:cost,c:0},{a:'1301',d:0,c:cost});
    const party=v(form,'party').trim()||(sale?'Cliente general':'Proveedor');
    const entry={id:ex?.id||uid(),date:v(form,'dt'),due:v(form,'due'),reference:v(form,'reference'),desc:`${sale?'Venta':'Compra'} - ${party}`,party,type:title,pay,items,stock:items.map(item=>({pid:item.p,q:sale?-item.q:item.q,unit:item.unit,unitCost:item.cost})),lines,...totals};
    if(sale){entry.customerId=customer?.id||'';entry.customer=saleCustomerSnapshot(form)}
    else {entry.supplierId=v(form,'supplierId');entry.supplier=supplierSnapshot(entry.supplierId)}
    updates.forEach(update=>{update.product.stock=update.quantity;update.product.cost=update.cost});
    if(ex)Object.assign(ex,entry);else S.entries.push(entry);
    save();view();
  });
  form.dataset.k=sale?'venta':'compra';form.elements.py.value=ex?.pay||(sale?'1101':'1102');
  form.dataset.invoiceId=ex?.id||'';
  if(sale)updateSaleCustomer(form);
  updateInvoiceTotals();
}
function updateInvoiceTotals(){const target=$('#invoice-totals');if(!target)return;let totals;try{totals=taxTotals(readItems())}catch(error){target.textContent=error.message;return}target.innerHTML=`Base: <b>${money(totals.subtotal)}</b> · IVA: <b>${money(totals.vat)}</b> · Total: <b>${money(totals.total)}</b>`}
ACT.venta=()=>invoiceForm(null,true);
ACT.compra=()=>invoiceForm(null,false);
ACT.editventa=data=>{const entry=S.entries.find(entry=>entry.id===data.id&&entry.type==='venta');if(entry)invoiceForm(entry,true)};
ACT.editcompra=data=>{const entry=S.entries.find(entry=>entry.id===data.id&&entry.type==='compra');if(entry)invoiceForm(entry,false)};
ACT.addItem=(data,button)=>{button.closest('form').querySelector('.items').insertAdjacentHTML('beforeend',itemRow({},true));updateInvoiceTotals()};
ACT.removeItem=(data,button)=>{button.closest('.item').remove();updateInvoiceTotals()};
listV=function(type,title,cta,action,extra=''){
  const [from,to]=rg(),entries=S.entries.filter(entry=>entry.type===type&&entry.date>=from&&entry.date<=to).sort((first,second)=>second.date.localeCompare(first.date));
  main(pageHead(title,`<button class="btn" data-a="${action}">${cta}</button>`)+extra+pbar()+accountingTable(['Fecha','Factura / detalle','Pago','Base','IVA','Total','Acciones'],entries.map(entry=>`<tr><td>${esc(entry.date)}</td><td>${esc(entry.reference||'')} ${esc(entry.party||entry.desc)}</td><td>${esc(PAY[entry.pay]||'')}</td><td>${money(entry.subtotal??entry.total)}</td><td>${money(entry.vat||0)}</td><td>${money(entry.total)}</td><td>${type==='venta'?actionButton('printEntry',entry.id,'Imprimir')+' '+actionButton('editventa',entry.id,'Editar'):type==='compra'?actionButton('editcompra',entry.id,'Editar'):actionButton('editgasto',entry.id,'Editar')} ${actionButton('delentry',entry.id,'Eliminar')}</td></tr>`).join('')));
  $('#main').insertAdjacentHTML('beforeend',`<p class="tt">Total del período: <b>${money(entries.reduce((total,entry)=>total+entry.total,0))}</b> · IVA: ${money(entries.reduce((total,entry)=>total+(entry.vat||0),0))}</p>`);
};
printRcpt=function(entry){
  const totals=entry.subtotal===undefined?{subtotal:entry.total,vat:entry.vat||0,total:entry.total}:entry;
  $('#rcpt')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="rcpt">${rh('Comprobante de venta',esc(entry.date))}<p>Factura: ${esc(entry.reference||entry.id)}<br>Cliente: ${esc(entry.party)}${entry.customer?.taxId?'<br>RUC / cédula: '+esc(entry.customer.taxId):''}${entry.customer?.address?'<br>Dirección: '+esc(entry.customer.address):''}<br>Pago: ${esc(PAY[entry.pay])}${entry.pay==='1201'&&entry.due?'<br>Vencimiento: '+esc(entry.due):''}</p><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio sin IVA</th><th>IVA %</th><th>Base</th></tr></thead><tbody>${(entry.items||[]).map(item=>`<tr><td>${esc(prod(item.p)?.name||'Producto')}</td><td>${esc(formatQuantity(item.q))}</td><td>${money(item.u)}</td><td>${esc(item.vatRate||0)}</td><td>${money(r2(item.q*item.u))}</td></tr>`).join('')}</tbody></table><p>Subtotal: ${money(totals.subtotal)}<br>IVA: ${money(totals.vat)}<br><b>Total: ${money(totals.total)}</b></p></div>`);
  document.body.classList.add('rc');const done=()=>{document.body.classList.remove('rc');$('#rcpt')?.remove();removeEventListener('afterprint',done)};addEventListener('afterprint',done);print();
};
ACT.delentry=data=>{
  const entry=S.entries.find(entry=>entry.id===data.id);if(!entry)return;
  if(invoicePayments(entry.id).length)return alert('Elimina o corrige primero los abonos vinculados a esta factura.');
  if(['nomina','liquidacion','fiscal','fiscal-pago'].includes(entry.type))return alert('Este asiento pertenece a un cierre protegido. Conserva el historial; usa un asiento de corrección si es necesario.');
  const updates=new Map();
  for(const movement of entry.stock||[]){const product=prod(movement.pid);if(product)updates.set(product.id,{product,quantity:(updates.get(product.id)?.quantity??product.stock)-movement.q})}
  for(const update of updates.values()){
    if(update.quantity<0)return alert('No se puede eliminar: dejaría existencias negativas.');
    if(entry.type==='compra'){
      const removed=(entry.items||[]).filter(item=>item.p===update.product.id).reduce((total,item)=>total+item.q*item.u,0);
      const value=update.product.stock*update.product.cost-removed;if(value<-.01)return alert('La eliminación dejaría una valoración negativa. Revisa los movimientos posteriores.');
      update.cost=update.quantity>0?r2(Math.max(0,value)/update.quantity):update.product.cost;
    }
  }
  if(!confirm('¿Eliminar el registro y revertir sus efectos contables y de inventario?'))return;
  for(const update of updates.values()){update.product.stock=quantityRound(update.quantity);if(update.cost!==undefined)update.product.cost=update.cost}
  S.entries=S.entries.filter(old=>old.id!==entry.id);save();view();
};
function productForm(product){
  modal(product?'Editar producto':'Nuevo producto',field('code','Código',product?.code||'')+field('name','Nombre',product?.name||'','text','required')+(product?'':amountField('cost','Costo unitario sin IVA')+field('stock','Existencia inicial',0,'number','min="0" step="any"'))+amountField('price','Precio de venta sin IVA',product?.price||0)+field('minimum','Stock mínimo',product?.min||0,'number','min="0" step="any"')+field('vat','IVA opcional (%) · 0 = no aplica',product?.vatRate||0,'number','min="0" max="100" step="0.01" required'),form=>{
    const record=product||{id:uid(),cost:r2(v(form,'cost')),stock:0};
    Object.assign(record,{code:v(form,'code'),name:v(form,'name').trim(),price:r2(v(form,'price')),min:+v(form,'minimum'),vatRate:+v(form,'vat')});
    if(!record.name)return 'Escribe el nombre.';
    if(!product){S.products.push(record);const quantity=+v(form,'stock'),total=r2(quantity*record.cost);if(quantity>0){S.entries.push({id:uid(),date:today(),desc:'Inventario inicial - '+record.name,type:'invini',lines:total?[{a:'1301',d:total,c:0},{a:'3101',d:0,c:total}]:[],stock:[{pid:record.id,q:quantity,unitCost:record.cost}],total});record.stock=quantity}}
    save();view();
  });
}
ACT.newprod=()=>productForm();ACT.editprod=data=>productForm(prod(data.id));
V.productos=()=>main(pageHead('Productos e inventario','<button class="btn" data-a="newprod">+ Producto</button>')+notice('El costo y precio se guardan sin IVA. El porcentaje opcional se propone en ventas y compras; el IVA acreditable no aumenta el costo del inventario.')+accountingTable(['Código','Producto','Costo','Precio','IVA opcional','Existencia','Valor','Acciones'],S.products.map(product=>`<tr><td>${esc(product.code)}</td><td>${esc(product.name)}${product.stock<=product.min?' ⚠️':''}</td><td>${money(product.cost)}</td><td>${money(product.price)}</td><td>${esc(product.vatRate||0)}%</td><td>${esc(product.stock)}</td><td>${money(r2(product.stock*product.cost))}</td><td>${actionButton('editprod',product.id,'Editar')} ${actionButton('ajuste',product.id,'Ajustar')} ${actionButton('delprod',product.id,'Eliminar')}</td></tr>`).join(''))+`<p class="tt">Inventario valorizado: <b>${money(S.products.reduce((total,product)=>total+product.stock*product.cost,0))}</b></p>`);
function expenseForm(ex){
  const form=modal(ex?'Editar gasto':'Nuevo gasto',field('date','Fecha',ex?.date||today(),'date','required')+field('description','Concepto',ex?.party||'','text','required')+field('reference','Factura',ex?.reference||'')+field('due','Vencimiento',ex?.due||ex?.date||today(),'date','required')+`<label>Cuenta de gasto<select name="account">${accOpts(ex?.expenseAccount||'6103',account=>account.tipo==='gasto')}</select></label>`+amountField('base','Monto sin IVA',ex?.subtotal??ex?.total??0)+field('vat','IVA acreditable opcional (%)',ex?.vatRate||0,'number','min="0" max="100" step="0.01" required')+`<label>Forma de pago<select name="pay">${payOpts('2101')}</select></label>`,form=>{
    const base=r2(v(form,'base')),rate=+v(form,'vat'),vat=r2(base*rate/100),total=r2(base+vat),pay=v(form,'pay');if(base<=0)return 'Indica un monto mayor que cero.';
    if(ex&&invoicePayments(ex.id).length&&(pay!==ex.pay||total<paidInvoice(ex.id)))return 'Conserva la forma de pago y un total igual o mayor a los abonos.';
    if(pay==='2101'&&v(form,'due')<v(form,'date'))return 'Revisa el vencimiento.';
    const lines=[{a:v(form,'account'),d:base,c:0},{a:pay,d:0,c:total}];if(vat)lines.push({a:'1202',d:vat,c:0});
    const record={id:ex?.id||uid(),type:'gasto',date:v(form,'date'),due:v(form,'due'),party:v(form,'description'),desc:'Gasto - '+v(form,'description'),reference:v(form,'reference'),expenseAccount:v(form,'account'),pay,subtotal:base,vat,vatRate:rate,total,lines};
    if(ex)Object.assign(ex,record);else S.entries.push(record);save();view();
  });form.elements.pay.value=ex?.pay||'1102';
}
ACT.gasto=()=>expenseForm();ACT.editgasto=data=>expenseForm(S.entries.find(entry=>entry.id===data.id));
function debtView(receivable){
  const records=invoices(receivable),pending=records.reduce((total,entry)=>total+invoiceBalance(entry),0);
  main(pageHead(receivable?'Registro de cuentas por cobrar':'Registro de cuentas por pagar',`<button class="btn" data-a="invoiceOpening" data-side="${receivable?'receive':'pay'}">+ Factura / saldo inicial</button> ${pbtn()}`)+`<div class="card kpi"><small>Saldo pendiente de facturas</small><b>${money(pending)}</b></div>`+notice('Los abonos nuevos se vinculan a una factura. Los cobros y pagos históricos sin vínculo siguen en el Diario, pero no se asignan automáticamente a una factura.')+accountingTable(['Factura','Fecha','Vencimiento','Cliente / proveedor','Monto original','Abonado','Deuda','Estado','Acciones'],records.map(entry=>`<tr><td>${esc(entry.reference||entry.id)}</td><td>${esc(entry.date)}</td><td>${esc(entry.due||entry.date)}</td><td>${esc(entry.party)}</td><td>${money(entry.total)}</td><td>${money(paidInvoice(entry.id))}</td><td>${money(invoiceBalance(entry))}</td><td>${badge(debtStatus(invoiceBalance(entry),entry.due||entry.date))}</td><td>${invoiceBalance(entry)>0?actionButton('invoicePay',entry.id,receivable?'Cobrar / abonar':'Pagar / abonar'):''} ${actionButton('invoiceHistory',entry.id,'Historial')}</td></tr>`).join('')));
}
V.cobrar=()=>debtView(true);V.pagar=()=>debtView(false);
ACT.invoiceOpening=data=>{const receivable=data.side==='receive',account=receivable?'1201':'2101';modal('Registrar factura / saldo inicial',notice('Usa esta opción para una factura no registrada en Ventas o Compras. No mueve inventario. Elige la contrapartida adecuada para no duplicar ingresos o gastos históricos.')+field('party',receivable?'Cliente':'Proveedor','','text','required')+field('reference','Número de factura','','text','required')+field('date','Fecha',today(),'date','required')+field('due','Vencimiento',today(),'date','required')+amountField('total','Monto total de deuda')+`<label>Cuenta de contrapartida<select name="contra">${accOpts('3102',record=>record.code!==account&&record.sub!=='ef')}</select></label>`,form=>{
  const total=r2(v(form,'total'));if(total<=0)return 'El monto debe ser mayor que cero.';if(v(form,'due')<v(form,'date'))return 'Revisa el vencimiento.';
  addEntry({date:v(form,'date'),due:v(form,'due'),reference:v(form,'reference'),party:v(form,'party'),desc:'Factura - '+v(form,'party'),type:'factura',pay:account,total,lines:receivable?[{a:account,d:total,c:0},{a:v(form,'contra'),d:0,c:total}]:[{a:v(form,'contra'),d:total,c:0},{a:account,d:0,c:total}]});view();
})};
ACT.invoicePay=data=>{const entry=S.entries.find(entry=>entry.id===data.id);if(!entry)return;const balance=invoiceBalance(entry),receivable=entry.pay==='1201';modal(receivable?'Cobro / abono de factura':'Pago / abono de factura',notice(`${entry.party} · ${entry.reference||entry.id} · Saldo: ${money(balance)}`)+field('date','Fecha',today(),'date','required')+amountField('total','Abono',balance)+cashSelect()+field('note','Referencia del pago'),form=>{
  const total=r2(v(form,'total'));if(total<=0||total>invoiceBalance(entry))return 'El abono debe ser positivo y no superar el saldo.';if(v(form,'date')<entry.date)return 'El pago no puede ser anterior a la factura.';
  const cash=v(form,'cash');if(!receivable&&!v(form,'note').trim())return 'Indica el número de comprobante del egreso.';addEntry({type:'abono',date:v(form,'date'),invoiceId:entry.id,customerId:entry.customerId||'',supplierId:entry.supplierId||'',reference:v(form,'note'),total,desc:`${receivable?'Cobro':'Pago'} ${entry.reference||entry.id} - ${v(form,'note')}`,lines:receivable?[{a:cash,d:total,c:0},{a:'1201',d:0,c:total}]:[{a:'2101',d:total,c:0},{a:cash,d:0,c:total}]});view();
})};
ACT.invoiceHistory=data=>{const entry=S.entries.find(entry=>entry.id===data.id);modal('Historial de abonos',accountingTable(['Fecha','Referencia','Abono'],invoicePayments(data.id).map(payment=>`<tr><td>${esc(payment.date)}</td><td>${esc(payment.desc)}</td><td>${money(payment.total)}</td></tr>`).join(''))+notice(`Saldo pendiente: ${money(invoiceBalance(entry))}`),()=>{},'Cerrar')};
ACT.cobro=()=>{R='cobrar';view()};ACT.pago=()=>{R='pagar';view()};
let KARDEX_PRODUCT='';
V.kardex=()=>{
  const product=prod(KARDEX_PRODUCT)||S.products[0];KARDEX_PRODUCT=product?.id||'';
  let rows='',balance=0;
  const [from,to]=rg();
  if(product){
    const movements=S.entries.flatMap(entry=>(entry.stock||[]).filter(movement=>movement.pid===product.id).map(movement=>({entry,movement}))).sort((first,second)=>first.entry.date.localeCompare(second.entry.date));
    balance=quantityRound(product.stock-movements.reduce((total,record)=>total+record.movement.q,0));
    let initial=balance;
    for(const {entry,movement} of movements){balance=quantityRound(balance+movement.q);if(entry.date<from){initial=balance;continue}if(entry.date>to)continue;const item=(entry.items||[]).find(item=>item.p===product.id),unitCost=movement.unitCost??item?.cost??(entry.type==='compra'?item?.u:undefined);
      rows+=`<tr><td>${esc(entry.date)}</td><td>${esc(entry.reference||entry.desc)}</td><td>${movement.q>0?esc(formatQuantity(movement.q)):'—'}</td><td>${movement.q<0?esc(formatQuantity(-movement.q)):'—'}</td><td>${esc(formatQuantity(balance))}</td><td>${money(unitCost??product.cost)}${unitCost===undefined?' *':''}</td><td>${money(Math.abs(movement.q)*(unitCost??product.cost))}</td></tr>`;
    }
    rows=`<tr class="ledger-opening"><td colspan="4">Saldo inicial del período</td><td>${esc(formatQuantity(initial))}</td><td colspan="2"></td></tr>`+rows;
  }
  main(pageHead('Cardex / Kardex',pbtn())+`<label class="noprint">Producto<select id="kardex-product">${S.products.map(record=>`<option value="${esc(record.id)}" ${record.id===KARDEX_PRODUCT?'selected':''}>${esc(record.name)}</option>`).join('')}</select></label>`+pbar()+notice('Entradas, salidas y saldo físico por producto. * Costo referencial actual en movimientos antiguos sin costo guardado; no constituye una revaloración histórica. Los saldos sin movimiento se muestran como apertura.')+accountingTable(['Fecha','Documento','Entrada','Salida','Existencia','Costo unitario','Valor del movimiento'],rows));
};
document.addEventListener('change',event=>{
  if(event.target.id==='kardex-product'){KARDEX_PRODUCT=event.target.value;view()}
  if(event.target.name==='p'){const row=event.target.closest('.item'),rate=+event.target.selectedOptions[0]?.dataset.vat||0;row.querySelector('[name=taxed]').checked=rate>0;row.querySelector('[name=vatRate]').value=rate||(S.cfg.print?.fiscalProfile?.taxRate??S.cfg.fiscal?.vatRate??AcontecInvoiceDesign.profile(S.cfg.invoiceCountry).taxRate);updateInvoiceTotals()}
});
document.addEventListener('input',event=>{if(event.target.closest('.item'))updateInvoiceTotals()});

function employeeForm(employee){
  modal(employee?'Editar expediente':'Nuevo empleado',field('name','Nombre completo',employee?.name||'','text','required')+field('username','Nombre de usuario (referencia del acceso)',employee?.username||'')+field('document','Documento / identificación',employee?.document||'')+field('start','Fecha de ingreso',employee?.start||today(),'date','required')+field('contract','Tipo de contrato',employee?.contract||'','text','required')+field('position','Puesto',employee?.position||'','text','required')+amountField('salary','Salario base mensual',employee?.salary||0)+field('department','Área / departamento',employee?.department||'General')+field('bank','Banco',employee?.bank||'')+field('bankAccount','Cuenta bancaria',employee?.bankAccount||'')+field('socialNumber','Número de seguridad social',employee?.socialNumber||'')+amountField('vacationsUsed','Vacaciones utilizadas (días)',employee?.vacationsUsed||0)+`<label class="ck"><input name="active" type="checkbox" ${employee?.active===false?'':'checked'}> Empleado activo</label>`,form=>{
    const record={id:employee?.id||uid(),name:v(form,'name').trim(),username:v(form,'username').trim(),document:v(form,'document'),start:v(form,'start'),contract:v(form,'contract'),position:v(form,'position'),department:v(form,'department'),salary:r2(v(form,'salary')),bank:v(form,'bank'),bankAccount:v(form,'bankAccount'),socialNumber:v(form,'socialNumber'),vacationsUsed:+v(form,'vacationsUsed'),active:form.elements.active.checked};
    if(!record.name)return 'Escribe el nombre.';if(record.start>today())return 'La fecha de ingreso no puede ser futura.';
    if(employee)Object.assign(employee,record);else S.employees.push(record);save();view();
  });
}
ACT.newEmployee=()=>employeeForm();ACT.editEmployee=data=>employeeForm(S.employees.find(employee=>employee.id===data.id));
V.personal=()=>main(pageHead('Expediente de empleados','<button class="btn" data-a="newEmployee">+ Empleado</button>')+notice('Los datos bancarios y de seguridad social pertenecen exclusivamente a esta empresa. Los empleados inactivos se conservan para mantener su historial.')+accountingTable(['Empleado','Ingreso','Contrato','Puesto','Salario mensual','Estado','Acciones'],S.employees.map(employee=>`<tr><td>${esc(employee.name)}<small class="ledger-sub">${esc(employee.username||'')}</small></td><td>${esc(employee.start)}</td><td>${esc(employee.contract)}</td><td>${esc(employee.position)}</td><td>${money(employee.salary)}</td><td>${employee.active===false?'Inactivo':'Activo'}</td><td>${actionButton('editEmployee',employee.id,'Editar expediente')}</td></tr>`).join('')));
const PERIOD_FACTORS={mensual:1,quincenal:.5,semanal:12/52};
function payrollNumbers(form){
  const rules=S.cfg.fiscal,employee=S.employees.find(record=>record.id===v(form,'employee'));
  const base=r2(v(form,'base')),overtime=r2(+v(form,'hours')*(employee?.salary||0)/rules.daysPerMonth/rules.workingHours*rules.overtimeFactor);
  const bonus=r2(v(form,'bonus')),commission=r2(v(form,'commission')),gross=r2(base+overtime+bonus+commission);
  const tax=r2(gross*(+v(form,'taxRate'))/100),social=r2(gross*(+v(form,'socialRate'))/100),loan=r2(v(form,'loan'));
  return {base,hours:+v(form,'hours'),overtime,bonus,commission,gross,tax,social,loan,net:r2(gross-tax-social-loan)};
}
function payrollForm(payroll){
  if(!S.employees.some(employee=>employee.active!==false))return alert('Registra un empleado activo antes de procesar una nómina.');
  const employee=S.employees.find(employee=>employee.id===payroll?.employeeId)||S.employees.find(employee=>employee.active!==false);
  const form=modal(payroll?'Editar nómina pendiente':'Procesar nómina',`<label>Empleado<select name="employee">${employeeOptions(employee.id)}</select></label><label>Frecuencia<select name="frequency"><option value="mensual">Mensual</option><option value="quincenal">Quincenal</option><option value="semanal">Semanal (12 / 52 del salario mensual)</option></select></label>`+field('from','Inicio del período',payroll?.from||today().slice(0,8)+'01','date','required')+field('to','Fin del período',payroll?.to||today(),'date','required')+field('date','Fecha del pago',payroll?.date||today(),'date','required')+amountField('base','Sueldo del período',payroll?.base??employee.salary)+amountField('hours','Horas extras',payroll?.hours||0)+amountField('bonus','Bonos',payroll?.bonus||0)+amountField('commission','Comisiones',payroll?.commission||0)+field('taxRate','Retención de impuestos (%)',payroll?.taxRate??S.cfg.fiscal.salaryTax,'number','min="0" max="100" step="0.01" required')+field('socialRate','Seguro social (%)',payroll?.socialRate??S.cfg.fiscal.socialRate,'number','min="0" max="100" step="0.01" required')+amountField('loan','Descuento por préstamo',payroll?.loan||0)+cashSelect()+notice('Las tasas y el factor de horas extra son definidos por tu empresa, no por una normativa incorporada. Las retenciones quedan como pasivos y los préstamos reducen la cuenta por cobrar al empleado.')+'<div id="payroll-preview" class="accounting-notice" aria-live="polite"></div>',form=>{
    const numbers=payrollNumbers(form),employeeId=v(form,'employee'),selected=S.employees.find(record=>record.id===employeeId),from=v(form,'from'),to=v(form,'to');
    if(!selected||selected.active===false)return 'Selecciona un empleado activo.';
    if(from>to||from<selected.start||v(form,'date')<to)return 'Revisa las fechas: el período no debe preceder al ingreso y el pago no debe preceder al fin del período.';
    if(numbers.gross<=0||numbers.net<0||Object.values(numbers).some(number=>!Number.isFinite(number)))return 'Revisa las percepciones y deducciones. El neto no puede ser negativo.';
    if(S.payrolls.some(record=>record.id!==payroll?.id&&record.employeeId===employeeId&&record.from<=to&&record.to>=from))return 'Ya existe una nómina para este empleado en fechas que se superponen.';
    const record={id:payroll?.id||uid(),employeeId,employeeName:selected.name,from,to,date:v(form,'date'),frequency:v(form,'frequency'),taxRate:+v(form,'taxRate'),socialRate:+v(form,'socialRate'),cash:v(form,'cash'),status:'Pendiente',...numbers};
    if(payroll)Object.assign(payroll,record);else S.payrolls.push(record);save();view();
  },'Guardar nómina pendiente');
  form.elements.frequency.value=payroll?.frequency||'mensual';form.elements.cash.value=payroll?.cash||'1102';updatePayrollPreview();
}
function updatePayrollPreview(){const target=$('#payroll-preview');if(!target)return;const numbers=payrollNumbers(target.closest('form'));target.innerHTML=`Horas extras: ${money(numbers.overtime)} · Percepciones: <b>${money(numbers.gross)}</b><br>Impuestos: ${money(numbers.tax)} · Seguro: ${money(numbers.social)} · Préstamos: ${money(numbers.loan)}<br>Neto a pagar: <b class="${numbers.net<0?'bad':'ok'}">${money(numbers.net)}</b>`}
ACT.newPayroll=()=>payrollForm();ACT.editPayroll=data=>{const record=S.payrolls.find(record=>record.id===data.id);if(record&&!record.entryId)payrollForm(record)};
ACT.closePayroll=async data=>{
  const payroll=S.payrolls.find(record=>record.id===data.id);if(!payroll||payroll.entryId)return;
  if(S.employees.find(employee=>employee.id===payroll.employeeId)?.active===false)return alert('El empleado está inactivo. Revisa su expediente antes de cerrar la nómina.');
  if(!confirm(`¿Cerrar y pagar la nómina de ${payroll.employeeName} por ${money(payroll.net)}? Se creará el asiento contable y el cierre será protegido.`))return;
  const lines=[{a:'6101',d:payroll.gross,c:0}];
  if(payroll.net)lines.push({a:payroll.cash,d:0,c:payroll.net});
  if(payroll.tax)lines.push({a:'2104',d:0,c:payroll.tax});if(payroll.social)lines.push({a:'2105',d:0,c:payroll.social});if(payroll.loan)lines.push({a:'1203',d:0,c:payroll.loan});
  payroll.entryId=uid();payroll.status='Cerrada';S.entries.push({id:payroll.entryId,type:'nomina',payrollId:payroll.id,date:payroll.date,desc:'Nómina - '+payroll.employeeName+' · '+payroll.from+' / '+payroll.to,lines,total:payroll.gross});save();view();
};
ACT.deletePayroll=data=>{const record=S.payrolls.find(record=>record.id===data.id);if(record?.entryId)return;if(confirm('¿Eliminar esta nómina pendiente?')){S.payrolls=S.payrolls.filter(record=>record.id!==data.id);save();view()}};
V.nomina=()=>main(pageHead('Procesamiento de nómina','<button class="btn" data-a="newPayroll">+ Nómina</button> '+pbtn())+accountingTable(['Empleado','Período','Percepciones','Impuestos','Seguro','Préstamos','Neto','Estado','Acciones'],S.payrolls.map(record=>`<tr><td>${esc(record.employeeName)}</td><td>${esc(record.from)} / ${esc(record.to)}</td><td>${money(record.gross)}</td><td>${money(record.tax)}</td><td>${money(record.social)}</td><td>${money(record.loan)}</td><td>${money(record.net)}</td><td>${badge(record.entryId?'Pagado':'Pendiente')}</td><td>${record.entryId?actionButton('payrollDetail',record.id,'Detalle'):actionButton('editPayroll',record.id,'Editar')+' '+actionButton('closePayroll',record.id,'Cerrar y pagar')+' '+actionButton('deletePayroll',record.id,'Eliminar')}</td></tr>`).join('')));
ACT.payrollDetail=data=>{const record=S.payrolls.find(record=>record.id===data.id);modal('Detalle de nómina',notice(`${record.employeeName} · ${record.from} / ${record.to}`)+accountingTable(['Concepto','Monto'],[['Sueldo',record.base],['Horas extras',record.overtime],['Bonos',record.bonus],['Comisiones',record.commission],['Impuestos',record.tax],['Seguro social',record.social],['Préstamos',record.loan],['Neto pagado',record.net]].map(([label,value])=>`<tr><td>${esc(label)}</td><td>${money(value)}</td></tr>`).join('')),()=>{},'Cerrar')};
const daysBetween=(from,to)=>Math.max(0,Math.floor((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)+1);
function settlementNumbers(form){
  const employee=S.employees.find(record=>record.id===v(form,'employee')),rules=S.cfg.fiscal,date=v(form,'date');
  const years=daysBetween(employee?.start||date,date)/365.25,daily=(employee?.salary||0)/rules.daysPerMonth;
  const yearStart=date.slice(0,4)+'-01-01',yearEnd=date.slice(0,4)+'-12-31';
  const fraction=Math.min(1,daysBetween(employee?.start>yearStart?employee.start:yearStart,date)/daysBetween(yearStart,yearEnd));
  const severance=r2(daily*years*(v(form,'reason')==='despido'?rules.dismissalDays:rules.resignationDays));
  const vacationDays=+v(form,'vacation'),vacation=r2(daily*vacationDays),bonus=r2(daily*rules.bonusDays*fraction),premium=r2(daily*rules.premiumDays*fraction),salary=r2(v(form,'salary'));
  return {years:r2(years),vacationDays,severance,vacation,bonus,premium,salary,total:r2(severance+vacation+bonus+premium+salary)};
}
function settlementForm(){
  const employee=S.employees.find(record=>record.active!==false);if(!employee)return alert('Registra un empleado activo primero.');
  modal('Calculadora de liquidación / finiquito',`<label>Empleado<select name="employee">${employeeOptions(employee.id)}</select></label><label>Motivo de salida<select name="reason"><option value="despido">Despido</option><option value="renuncia">Renuncia</option></select></label>`+field('date','Fecha de salida / pago',today(),'date','required')+amountField('vacation','Vacaciones pendientes (días)',Math.max(0,r2(daysBetween(employee.start,today())/365.25*S.cfg.fiscal.vacationDays-(employee.vacationsUsed||0))))+amountField('salary','Salario pendiente por pagar')+cashSelect()+notice('Estimación parametrizada, no cálculo legal certificado. La indemnización usa días por año configurados; aguinaldo y prima son proporcionales al año calendario. Revisa vacaciones y pagos previos para evitar duplicaciones.')+'<div id="settlement-preview" class="accounting-notice" aria-live="polite"></div>',form=>{
    const selected=S.employees.find(record=>record.id===v(form,'employee')),date=v(form,'date'),numbers=settlementNumbers(form);
    if(!selected||date<selected.start)return 'La salida no puede preceder al ingreso.';
    if(S.settlements.some(record=>record.employeeId===selected.id))return 'Este empleado ya tiene una liquidación. Revisa su historial antes de continuar.';
    if(S.payrolls.some(record=>record.employeeId===selected.id&&!record.entryId))return 'Cierra o elimina primero las nóminas pendientes del empleado.';
    if(numbers.total<=0||Object.values(numbers).some(number=>!Number.isFinite(number)))return 'Configura los parámetros o indica un monto pendiente mayor que cero.';
    S.settlements.push({id:uid(),employeeId:selected.id,employeeName:selected.name,date,reason:v(form,'reason'),cash:v(form,'cash'),...numbers});save();view();
  },'Guardar estimación');updateSettlementPreview();
}
function updateSettlementPreview(){const target=$('#settlement-preview');if(!target)return;const numbers=settlementNumbers(target.closest('form'));target.innerHTML=`Indemnización: ${money(numbers.severance)}<br>Vacaciones: ${money(numbers.vacation)} · Aguinaldo proporcional: ${money(numbers.bonus)} · Prima proporcional: ${money(numbers.premium)}<br>Salario pendiente: ${money(numbers.salary)}<br><b>Total estimado: ${money(numbers.total)}</b>`}
ACT.newSettlement=()=>settlementForm();
ACT.closeSettlement=data=>{
  const record=S.settlements.find(record=>record.id===data.id);if(!record||record.entryId)return;
  if(S.payrolls.some(payroll=>payroll.employeeId===record.employeeId&&!payroll.entryId))return alert('Cierra o elimina primero las nóminas pendientes del empleado.');
  if(!confirm(`¿Pagar ${money(record.total)} y cerrar la salida de ${record.employeeName}?`))return;
  record.entryId=uid();const employee=S.employees.find(employee=>employee.id===record.employeeId);if(employee){employee.active=false;employee.end=record.date}
  S.entries.push({id:record.entryId,type:'liquidacion',date:record.date,settlementId:record.id,desc:'Liquidación - '+record.employeeName,lines:[{a:'6101',d:record.total,c:0},{a:record.cash,d:0,c:record.total}],total:record.total});save();view();
};
ACT.deleteSettlement=data=>{const record=S.settlements.find(record=>record.id===data.id);if(record?.entryId)return;if(confirm('¿Eliminar esta estimación?')){S.settlements=S.settlements.filter(record=>record.id!==data.id);save();view()}};
V.liquidaciones=()=>main(pageHead('Liquidaciones y finiquitos','<button class="btn" data-a="newSettlement">+ Calcular salida</button> '+pbtn())+notice('Los resultados dependen exclusivamente de las reglas configuradas por la empresa. El cierre crea el gasto y la salida de dinero en el Libro Diario y conserva el expediente inactivo.')+accountingTable(['Empleado','Salida','Motivo','Indemnización','Vacaciones','Aguinaldo','Prima','Salario pendiente','Total','Acciones'],S.settlements.map(record=>`<tr><td>${esc(record.employeeName)}</td><td>${esc(record.date)}</td><td>${esc(record.reason)}</td><td>${money(record.severance)}</td><td>${money(record.vacation)}</td><td>${money(record.bonus)}</td><td>${money(record.premium)}</td><td>${money(record.salary)}</td><td>${money(record.total)}</td><td>${record.entryId?badge('Pagado'):actionButton('closeSettlement',record.id,'Cerrar y pagar')+' '+actionButton('deleteSettlement',record.id,'Eliminar estimación')}</td></tr>`).join('')));
V.provisiones=()=>{
  const rules=S.cfg.fiscal;let total=0;
  const rows=S.employees.filter(employee=>employee.active!==false).map(employee=>{
    const daily=employee.salary/rules.daysPerMonth,bonus=r2(daily*rules.bonusDays/12),premium=r2(daily*rules.premiumDays/12),vacation=r2(daily*rules.vacationDays/12),severance=r2(daily*rules.dismissalDays/12),reserve=r2(bonus+premium+vacation+severance);total+=reserve;
    return `<tr><td>${esc(employee.name)}</td><td>${money(bonus)}</td><td>${money(premium)}</td><td>${money(vacation)}</td><td>${money(severance)}</td><td>${money(reserve)}</td></tr>`;
  }).join('');
  main(pageHead('Provisiones mensuales',pbtn())+notice('Reserva orientativa por empleado basada en días de prestaciones por año. No mueve dinero ni genera asientos automáticamente; no incluye aportes patronales que no hayas configurado.')+`<div class="card kpi"><small>Reserva mensual estimada</small><b>${money(total)}</b></div>`+accountingTable(['Empleado','Aguinaldo','Prima','Vacaciones','Indemnización','Reserva mensual'],rows));
};
document.addEventListener('input',event=>{if(event.target.closest('form')?.querySelector('#payroll-preview'))updatePayrollPreview();if(event.target.closest('form')?.querySelector('#settlement-preview'))updateSettlementPreview()});
document.addEventListener('change',event=>{
  const form=event.target.closest('form');if(!form)return;
  if(form.querySelector('#payroll-preview')){
    if(['employee','frequency'].includes(event.target.name)){const employee=S.employees.find(record=>record.id===v(form,'employee'));form.elements.base.value=r2((employee?.salary||0)*PERIOD_FACTORS[v(form,'frequency')])}
    updatePayrollPreview();
  }
  if(form.querySelector('#settlement-preview')){
    if(['employee','date'].includes(event.target.name)){const employee=S.employees.find(record=>record.id===v(form,'employee'));form.elements.vacation.value=Math.max(0,r2(daysBetween(employee.start,v(form,'date'))/365.25*S.cfg.fiscal.vacationDays-(employee.vacationsUsed||0)))}
    updateSettlementPreview();
  }
});

const RULE_FIELDS=[
  ['vatRate','IVA sugerido (%)',100],['incomeRate','Impuesto anual sobre utilidad (%)',100],
  ['salaryTax','Retención de nómina (%)',100],['socialRate','Seguro social del empleado (%)',100],
  ['daysPerMonth','Días base por mes',366],['workingHours','Horas ordinarias por día',24],['overtimeFactor','Multiplicador de hora extra',10],
  ['bonusDays','Días de aguinaldo por año',366],['premiumDays','Días de prima por año',366],['vacationDays','Días de vacaciones por año',366],
  ['dismissalDays','Días de indemnización por año · despido',366],['resignationDays','Días de indemnización por año · renuncia',366]
];
V.reglas=()=>main(pageHead('Reglas laborales y fiscales','<button class="btn" data-a="editRules">Editar parámetros</button>')+notice('Cada empresa define sus propios parámetros. Las tasas y prestaciones comienzan en cero; no se supone un país ni una normativa. Los reportes y las liquidaciones son estimaciones que debes revisar con tu asesor.')+accountingTable(['Parámetro','Valor'],RULE_FIELDS.map(([name,label])=>`<tr><td>${esc(label)}</td><td>${esc(S.cfg.fiscal[name])}</td></tr>`).join(''))+`<div class="card"><h3>Exportación configurable</h3><p>Columnas: ${esc(S.cfg.fiscal.exportColumns)}</p><p class="mut">CSV UTF-8 con separador y decimal configurables. Sin una plantilla de la entidad tributaria, no es un formato oficial certificado.</p></div>`);
ACT.editRules=()=>{
  const form=modal('Parámetros de la empresa',notice('Cambiar reglas no altera cierres existentes. Las tasas y días deben ser verificados por el responsable de la empresa.')+RULE_FIELDS.map(([name,label,maximum])=>field(name,label,S.cfg.fiscal[name],'number',`min="${['daysPerMonth','workingHours','overtimeFactor'].includes(name)?'.01':'0'}" max="${maximum}" step="0.01" required`)).join('')+`<label>Separador CSV<select name="delimiter"><option value=";">Punto y coma</option><option value=",">Coma</option><option value="tab">Tabulación</option></select></label><label>Separador decimal<select name="decimal"><option value=".">Punto</option><option value=",">Coma</option></select></label><label>Columnas CSV y encabezados<textarea name="exportColumns" rows="3" required>${esc(S.cfg.fiscal.exportColumns)}</textarea></label>`+notice('Lista separada por comas. Claves disponibles: concepto, periodo, vencimiento, base, tasa, monto, pagado, saldo, estado, referencia, propiedad. Personaliza el encabezado con clave:Encabezado; por ejemplo monto:Importe.'),form=>{
    const rules={...S.cfg.fiscal};for(const [name] of RULE_FIELDS)rules[name]=+v(form,name);
    rules.delimiter=v(form,'delimiter');rules.decimal=v(form,'decimal');rules.exportColumns=v(form,'exportColumns').trim();
    const allowed=['concepto','periodo','vencimiento','base','tasa','monto','pagado','saldo','estado','referencia','propiedad','iva_cobrado','iva_acreditable','credito_aplicado','saldo_favor','ingresos','costos','gastos','utilidad'];
    if(!rules.exportColumns||rules.exportColumns.split(',').some(column=>!allowed.includes(column.split(':')[0].trim())))return 'Revisa las claves de las columnas CSV.';
    S.cfg.fiscal=rules;save();view();
  });form.elements.delimiter.value=S.cfg.fiscal.delimiter;form.elements.decimal.value=S.cfg.fiscal.decimal;
  form.querySelector('.mb').insertAdjacentHTML('beforeend',notice('Columnas adicionales: iva_cobrado, iva_acreditable, credito_aplicado, saldo_favor, ingresos, costos, gastos, utilidad.'));
};
const paidTax=id=>r2(S.entries.filter(entry=>entry.taxId===id&&entry.type==='fiscal-pago'&&!S.entries.some(record=>record.reversalOf===entry.id)).reduce((total,entry)=>total+entry.total,0));
const taxBalance=tax=>r2(tax.amount-paidTax(tax.id));
const taxStatus=tax=>tax.credit>0?'Saldo a favor':tax.amount===0?'Sin deuda':taxBalance(tax)<=0?'Pagado':tax.due<today()?'Vencida':'Pendiente';
function taxRows(taxes){return taxes.map(tax=>`<tr><td>${esc(tax.name)}<small class="ledger-sub">${esc(tax.period||'')} ${esc(tax.propertyName||'')}${tax.credit?'<br>Saldo a favor: '+money(tax.credit):''}</small></td><td>${esc(tax.due)}</td><td>${money(tax.amount)}</td><td>${money(paidTax(tax.id))}</td><td>${money(taxBalance(tax))}</td><td>${badge(taxStatus(tax))}</td><td>${taxBalance(tax)>0?actionButton('payTax',tax.id,'Pagar / abonar')+' ':''}${actionButton('taxDetails',tax.id,'Historial')} ${actionButton('editTax',tax.id,'Editar')} ${tax.receipt?actionButton('downloadReceipt',tax.id,'Comprobante')+' '+actionButton('deleteReceipt',tax.id,'Quitar archivo'):paidTax(tax.id)>0?actionButton('uploadReceipt',tax.id,'Adjuntar PDF / foto'):''} ${['mensual','anual'].includes(tax.frequency)?actionButton('nextTax',tax.id,'Siguiente período'):''} ${!paidTax(tax.id)&&!tax.receipt?actionButton('removeTax',tax.id,tax.source==='manual'?'Eliminar':'Reabrir cálculo'):''}</td></tr>`).join('')}
const taxHeaders=['Obligación / período','Vencimiento','Monto','Abonado','Deuda','Estado','Acciones'];
V.fiscal=()=>{
  const taxes=[...S.taxes].sort((first,second)=>first.due.localeCompare(second.due));
  const overdue=taxes.filter(tax=>taxBalance(tax)>0&&tax.due<today()),soon=taxes.filter(tax=>taxBalance(tax)>0&&tax.due>=today()&&daysBetween(today(),tax.due)<=8);
  main(pageHead('Calendario y agenda fiscal','<button class="btn" data-a="newTax">+ Obligación</button> <button class="btn ghost" data-a="exportTaxes">Descargar CSV</button> '+pbtn())+`<div class="fiscal-summary"><div class="card kpi"><small>Vencidas</small><b class="bad">${overdue.length}</b></div><div class="card kpi"><small>Vencen en 7 días</small><b>${soon.length}</b></div><div class="card kpi"><small>Deuda fiscal registrada</small><b>${money(taxes.reduce((total,tax)=>total+taxBalance(tax),0))}</b></div></div>`+notice('Alertas al abrir el panel, sin envíos automáticos ni funciones programadas. Configura cada fecha límite según tus obligaciones; la frecuencia no presupone un país.')+['mensual','anual','unica'].map(frequency=>`<h3 class="ledger-section">${frequency==='mensual'?'Obligaciones mensuales':frequency==='anual'?'Obligaciones anuales':'Otras fechas y tasas locales'}</h3>`+accountingTable(taxHeaders,taxRows(taxes.filter(tax=>(tax.frequency||'unica')===frequency)))).join(''));
};
function taxForm(tax,defaults={}){
  const initial=tax||defaults,derived=tax&&tax.source!=='manual';
  const body=field('name','Concepto',initial.name||'','text','required')+`<label>Frecuencia<select name="frequency"><option value="mensual">Mensual</option><option value="anual">Anual</option><option value="unica">Fecha única</option></select></label>`+field('period','Período declarado',initial.period||today().slice(0,7),'text','required')+field('due','Fecha límite',initial.due||today(),'date','required')+field('reference','Referencia / declaración',initial.reference||'')+(derived?notice('El monto procede de un cierre contable. Solo se pueden editar el concepto, la fecha y la referencia.'):
    amountField('amount','Monto de obligación',initial.amount||0)+`<label>Cuenta de gasto / contrapartida<select name="expense">${accOpts(initial.expense||'6107',account=>account.tipo==='gasto'||account.tipo==='activo')}</select></label><label>Cuenta de deuda fiscal<select name="liability">${accOpts(initial.liability||'2102',account=>account.tipo==='pasivo')}</select></label><label class="ck"><input name="recognized" type="checkbox" ${initial.recognized?'checked':''}> La deuda ya fue registrada en el Libro Diario</label>`+notice('Si la deuda aún no existe en el Diario, se registra el gasto contra el pasivo al guardar. Marca la casilla solo para una deuda realmente registrada, como retenciones de nómina.'));
  const form=modal(tax?'Editar obligación':'Nueva obligación fiscal',body,form=>{
    if(tax&&(paidTax(tax.id)>0||tax.receipt)&&!derived)return 'Una obligación con pagos o comprobantes conserva su importe. Registra una corrección contable por separado.';
    const common={name:v(form,'name').trim(),frequency:derived?tax.frequency:v(form,'frequency'),period:derived?tax.period:v(form,'period'),due:v(form,'due'),reference:v(form,'reference')};if(!common.name)return 'Escribe el concepto.';
    if(derived){Object.assign(tax,common);save();view();return}
    const amount=r2(v(form,'amount'));if(amount<=0)return 'El monto debe ser mayor que cero.';
    const id=tax?.id||uid(),recognized=form.elements.recognized.checked,liability=v(form,'liability'),expense=v(form,'expense');
    if(tax?.entryId)S.entries=S.entries.filter(entry=>entry.id!==tax.entryId);
    const record={id,source:'manual',...common,amount,liability,expense,recognized,propertyId:initial.propertyId||'',propertyName:initial.propertyName||'',base:initial.base||amount,rate:initial.rate||0};
    if(!recognized){record.entryId=uid();S.entries.push({id:record.entryId,type:'fiscal',taxId:id,date:initial.date||today(),desc:'Obligación fiscal - '+common.name,total:amount,lines:[{a:expense,d:amount,c:0},{a:liability,d:0,c:amount}]})}
    if(tax)Object.assign(tax,{entryId:null},record);else S.taxes.push(record);save();view();
  });form.elements.frequency.value=initial.frequency||'mensual';if(derived){form.elements.frequency.disabled=true;form.elements.period.readOnly=true}
}
ACT.newTax=()=>taxForm();ACT.editTax=data=>{const tax=S.taxes.find(record=>record.id===data.id);if(tax)taxForm(tax)};
ACT.removeTax=data=>{
  const tax=S.taxes.find(record=>record.id===data.id);if(!tax||paidTax(tax.id)>0||tax.receipt)return;
  if(tax.credit>0&&S.taxes.some(record=>record.source==='iva'&&record.period>tax.period&&record.usedCredit>0))return alert('Hay un cierre posterior que utiliza créditos previos. Reabre primero los cierres dependientes sin pagos o registra un ajuste con tu asesor.');
  if(!confirm('¿Quitar esta obligación sin pagos y revertir su asiento de reconocimiento? Podrás calcularla y registrarla de nuevo.'))return;
  if(tax.entryId)S.entries=S.entries.filter(entry=>entry.id!==tax.entryId);S.taxes=S.taxes.filter(record=>record.id!==tax.id);save();view();
};
ACT.payTax=data=>{
  const tax=S.taxes.find(record=>record.id===data.id);if(!tax||taxBalance(tax)<=0)return;
  modal('Registrar pago fiscal',notice(`${tax.name} · Deuda pendiente: ${money(taxBalance(tax))}`)+field('date','Fecha del pago',today(),'date','required')+amountField('amount','Pago / abono',taxBalance(tax))+cashSelect()+field('reference','Número de comprobante','','text','required'),form=>{
    const amount=r2(v(form,'amount'));if(amount<=0||amount>taxBalance(tax))return 'El pago debe ser positivo y no superar la deuda.';
    const cash=v(form,'cash');S.entries.push({id:uid(),type:'fiscal-pago',taxId:tax.id,date:v(form,'date'),desc:'Pago fiscal - '+tax.name+' · '+v(form,'reference'),reference:v(form,'reference'),total:amount,lines:[{a:tax.liability||'2102',d:amount,c:0},{a:cash,d:0,c:amount}]});save();view();
  },'Registrar pago y asiento');
};
ACT.taxDetails=data=>{
  const tax=S.taxes.find(record=>record.id===data.id),payments=S.entries.filter(entry=>entry.taxId===tax.id&&entry.type==='fiscal-pago');
  modal('Historial de obligación fiscal',notice(`${tax.name} · ${tax.period} · Saldo: ${money(taxBalance(tax))}`)+accountingTable(['Fecha','Comprobante','Pago'],payments.map(entry=>`<tr><td>${esc(entry.date)}</td><td>${esc(entry.reference)}</td><td>${money(entry.total)}</td></tr>`).join(''))+notice(tax.receipt?'Archivo adjunto: '+tax.receipt.name:'Sin soporte digital adjunto. Puedes adjuntar un comprobante consolidado después de registrar el pago.'),()=>{},'Cerrar');
};
function followingDate(date,frequency){
  const [year,month,day]=date.split('-').map(Number),target=new Date(Date.UTC(year+(frequency==='anual'?1:0),month-1+(frequency==='mensual'?1:0),1));
  const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(day,lastDay));return target.toISOString().slice(0,10);
}
ACT.nextTax=data=>{
  const tax=S.taxes.find(record=>record.id===data.id);if(!tax)return;
  if(tax.source!=='manual'){R='impuestos';view();return alert('Calcula el siguiente período desde IVA y renta para usar sus cifras reales.');}
  const due=followingDate(tax.due,tax.frequency),period=tax.frequency==='mensual'?due.slice(0,7):due.slice(0,4);
  if(S.taxes.some(record=>record.name===tax.name&&record.due===due))return alert('Ya existe esta obligación para la siguiente fecha.');
  taxForm(null,{...tax,id:undefined,entryId:undefined,receipt:undefined,due,period,recognized:false});
};
let TAX_MONTH=today().slice(0,7),TAX_YEAR=String(new Date().getFullYear());
function vatReport(month){
  const from=month+'-01',last=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).toISOString().slice(0,10);let output=0,input=0,baseSales=0,basePurchases=0;
  for(const entry of S.entries){
    if(entry.date<from||entry.date>last||['fiscal','fiscal-pago'].includes(entry.type))continue;
    for(const line of entry.lines){if(line.a==='2106')output+=(+line.c||0)-(+line.d||0);if(line.a==='1202')input+=(+line.d||0)-(+line.c||0)}
    if(['venta','nota-credito'].includes(entry.type))baseSales+=(entry.subtotal??entry.total)*(entry.type==='nota-credito'?-1:1);if(['compra','gasto','costo'].includes(entry.type)&&!entry.reversalOf)basePurchases+=entry.subtotal??entry.total;
  }
  return {from,to:last,output:r2(output),input:r2(input),baseSales:r2(baseSales),basePurchases:r2(basePurchases),net:r2(output-input)};
}
function vatCreditAvailable(period){return Math.max(0,r2(S.taxes.filter(tax=>tax.source==='iva'&&tax.period<period).reduce((total,tax)=>total+(tax.credit||0)-(tax.usedCredit||0),0)))}
function annualReport(year){if(S.fiscalSummary){const row=S.fiscalSummary[year]||{},income=(row.incomeCents||0)/100,cost=(row.costCents||0)/100,expense=(row.expenseCents||0)/100,profit=r2(income-cost-expense);return {income,cost,expense,profit,tax:r2(Math.max(0,profit)*S.cfg.fiscal.incomeRate/100)}}const balances=bal(year+'-01-01',year+'-12-31'),income=tot(balances,'ingreso'),cost=tot(balances,'costo'),expense=tot(balances,'gasto'),previousTax=balances['6108']?sg(balances['6108']):0,profit=r2(income-cost-expense+previousTax);return {income:r2(income),cost:r2(cost),expense:r2(expense-previousTax),profit,tax:r2(Math.max(0,profit)*S.cfg.fiscal.incomeRate/100)}}
V.impuestos=()=>{
  const vat=vatReport(TAX_MONTH),annual=annualReport(TAX_YEAR);
  const savedVAT=S.taxes.find(tax=>tax.source==='iva'&&tax.period===TAX_MONTH),savedIncome=S.taxes.find(tax=>tax.source==='renta'&&tax.period===TAX_YEAR);
  const changed=(savedVAT&&JSON.stringify(savedVAT.calculation)!==JSON.stringify({output:vat.output,input:vat.input,net:vat.net}))||(savedIncome&&savedIncome.amount!==annual.tax);
  main(pageHead('IVA mensual y renta anual','<button class="btn ghost" data-a="exportTaxReport">Exportar cálculo CSV</button> <button class="btn ghost" data-a="exportTaxes">Exportar obligaciones</button> '+pbtn())+notice('Cálculos orientativos sin ajustes fiscales legales automáticos. El IVA cruza el impuesto registrado en ventas, compras y gastos; la renta usa la utilidad contable antes del impuesto sobre ganancias. Revisa gastos deducibles, exenciones y ajustes antes de declarar.')+(changed?notice('Las cifras actuales difieren de un registro fiscal anterior. Si aún no tiene pagos, reabre el cálculo desde la Agenda fiscal y regístralo de nuevo. Si ya tiene pagos, registra una obligación y un asiento de ajuste con tu asesor.'):'' )+`<div class="tax-report-grid"><section class="card"><h3>IVA mensual</h3><label>Período<input id="tax-month" type="month" value="${TAX_MONTH}" required></label><dl class="ledger-totals"><dt>Ventas sin IVA</dt><dd>${money(vat.baseSales)}</dd><dt>Compras y gastos sin IVA</dt><dd>${money(vat.basePurchases)}</dd><dt>IVA cobrado / débito</dt><dd>${money(vat.output)}</dd><dt>IVA acreditable / crédito</dt><dd>${money(vat.input)}</dd><dt>${vat.net>=0?'IVA a pagar':'Saldo a favor'}</dt><dd><b>${money(Math.abs(vat.net))}</b></dd></dl><button class="btn" data-a="closeVAT">Registrar cierre de IVA</button></section><section class="card"><h3>Proyección de renta anual</h3><label>Año<input id="tax-year" type="number" min="1900" max="9998" value="${TAX_YEAR}" required></label><dl class="ledger-totals"><dt>Ingresos</dt><dd>${money(annual.income)}</dd><dt>Costos</dt><dd>${money(annual.cost)}</dd><dt>Gastos antes de renta</dt><dd>${money(annual.expense)}</dd><dt>Utilidad contable</dt><dd>${money(annual.profit)}</dd><dt>Tasa configurada</dt><dd>${esc(S.cfg.fiscal.incomeRate)}%</dd><dt>Impuesto estimado</dt><dd><b>${money(annual.tax)}</b></dd></dl><button class="btn" data-a="closeIncome">Registrar proyección anual</button></section></div>`);
};
ACT.closeVAT=()=>{
  const month=TAX_MONTH,report=vatReport(month),available=vatCreditAvailable(month);if(S.taxes.some(tax=>tax.source==='iva'&&tax.period===month))return alert('Este período ya tiene un cierre de IVA registrado. Reábrelo desde la Agenda si aún no tiene pagos.');
  if(report.output<0||report.input<0)return alert('El período tiene ajustes negativos. Revisa el Diario con tu asesor antes de cerrar.');
  if(report.output===0&&report.input===0)return alert('No hay IVA registrado en este período.');
  modal('Registrar cierre mensual de IVA',notice(`IVA cobrado: ${money(report.output)} · IVA acreditable: ${money(report.input)} · ${report.net>=0?'Deuda':'Saldo a favor'}: ${money(Math.abs(report.net))}. Créditos de cierres anteriores disponibles: ${money(available)}. Su aplicación es opcional y debe estar permitida por tus reglas fiscales.`)+field('carry','Crédito previo a aplicar',0,'number',`min="0" max="${Math.max(0,Math.min(available,report.net))}" step="0.01" required`)+field('due','Fecha límite de declaración',today(),'date','required'),form=>{
    const usedCredit=r2(v(form,'carry'));if(usedCredit<0||usedCredit>Math.max(0,Math.min(vatCreditAvailable(month),report.net)))return 'El crédito aplicado supera lo disponible o la deuda del mes.';
    const id=uid(),entryId=uid(),offset=Math.min(report.output,report.input),lines=[];
    if(offset)lines.push({a:'2106',d:offset,c:0},{a:'1202',d:0,c:offset});
    if(report.net>0){lines.push({a:'2106',d:report.net,c:0});if(usedCredit)lines.push({a:'1202',d:0,c:usedCredit});if(report.net>usedCredit)lines.push({a:'2102',d:0,c:r2(report.net-usedCredit)})}
    S.taxes.push({id,source:'iva',name:'IVA '+month,frequency:'mensual',period:month,due:v(form,'due'),amount:Math.max(0,r2(report.net-usedCredit)),credit:Math.max(0,-report.net),usedCredit,base:report.baseSales,rate:0,liability:'2102',entryId:lines.length?entryId:null,calculation:{output:report.output,input:report.input,net:report.net}});
    if(lines.length)S.entries.push({id:entryId,taxId:id,type:'fiscal',date:report.to,desc:'Cierre IVA '+month,total:report.output,lines});save();R='fiscal';view();
  },'Registrar cierre');
};
ACT.closeIncome=()=>{
  const year=TAX_YEAR;if(S.taxes.some(tax=>tax.source==='renta'&&tax.period===year))return alert('Ya existe una proyección anual registrada para ese año.');
  const report=annualReport(year);if(report.tax<=0)return alert('Configura una tasa de renta y verifica que exista utilidad gravable positiva.');
  modal('Registrar proyección anual',notice(`Utilidad antes de renta: ${money(report.profit)} · Tasa: ${S.cfg.fiscal.incomeRate}% · Impuesto estimado: ${money(report.tax)}. Este registro no presenta una declaración oficial.`)+field('due','Fecha límite de pago',today(),'date','required'),form=>{
    const id=uid(),entryId=uid();S.taxes.push({id,entryId,source:'renta',name:'Renta anual '+year,frequency:'anual',period:year,due:v(form,'due'),amount:report.tax,base:Math.max(0,report.profit),rate:S.cfg.fiscal.incomeRate,liability:'2102',calculation:report});
    S.entries.push({id:entryId,taxId:id,type:'fiscal',date:year+'-12-31',desc:'Proyección de renta '+year,total:report.tax,lines:[{a:'6108',d:report.tax,c:0},{a:'2102',d:0,c:report.tax}]});save();R='fiscal';view();
  },'Registrar estimación');
};
function exportTaxRows(taxes,name){
  const rules=S.cfg.fiscal,separator=rules.delimiter==='tab'?'\t':rules.delimiter,columns=rules.exportColumns.split(',').map(column=>{const [key,...label]=column.trim().split(':');return {key:key.trim(),label:label.join(':')||key.trim()}});
  const cell=value=>{let text=typeof value==='number'?value.toFixed(2).replace('.',rules.decimal):String(value??'');if(typeof value!=='number'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'};
  const rows=taxes.map(tax=>{const calculation=tax.calculation||{},record={concepto:tax.name,periodo:tax.period,vencimiento:tax.due,base:tax.base||0,tasa:tax.rate||0,monto:tax.amount,pagado:paidTax(tax.id),saldo:tax.credit>0?-tax.credit:taxBalance(tax),estado:taxStatus(tax),referencia:tax.reference||'',propiedad:tax.propertyName||'',iva_cobrado:calculation.output||0,iva_acreditable:calculation.input||0,credito_aplicado:tax.usedCredit||0,saldo_favor:tax.credit||0,ingresos:calculation.income||0,costos:calculation.cost||0,gastos:calculation.expense||0,utilidad:calculation.profit||0};return columns.map(column=>cell(record[column.key])).join(separator)});
  const content='\uFEFF'+[columns.map(column=>cell(column.label)).join(separator),...rows].join('\r\n');downloadFile(new Blob([content],{type:'text/csv;charset=utf-8'}),name);
}
ACT.exportTaxes=()=>exportTaxRows(S.taxes,'obligaciones-'+today()+'.csv');
ACT.exportTaxReport=()=>{const vat=vatReport(TAX_MONTH),annual=annualReport(TAX_YEAR);exportTaxRows([{name:'Estimación de IVA',period:TAX_MONTH,base:vat.baseSales,amount:Math.max(0,vat.net),credit:Math.max(0,-vat.net),calculation:vat},{name:'Estimación de renta anual',period:TAX_YEAR,base:Math.max(0,annual.profit),rate:S.cfg.fiscal.incomeRate,amount:annual.tax,calculation:annual}], 'calculo-fiscal-'+today()+'.csv')};
function downloadFile(blob,name){const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.addEventListener('change',event=>{
  if(event.target.id==='tax-month'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)){TAX_MONTH=event.target.value;view()}
  if(event.target.id==='tax-year'&&event.target.checkValidity()){TAX_YEAR=event.target.value;view()}
});
function propertyForm(property){
  const form=modal(property?'Editar propiedad':'Ficha de propiedad',field('name','Nombre / ubicación',property?.name||'','text','required')+`<label>Tipo<select name="type"><option>Oficina</option><option>Bodega</option><option>Terreno</option><option>Otro</option></select></label>`+field('cadastral','Número catastral',property?.cadastral||'','text','required')+amountField('value','Valor fiscal',property?.value||0)+field('rate','Tasa predial sugerida (%)',property?.rate||0,'number','min="0" max="100" step="0.01" required'),form=>{
    const record={id:property?.id||uid(),name:v(form,'name').trim(),type:v(form,'type'),cadastral:v(form,'cadastral'),value:r2(v(form,'value')),rate:+v(form,'rate')};if(!record.name)return 'Escribe el nombre.';
    if(property)Object.assign(property,record);else S.properties.push(record);save();view();
  });form.elements.type.value=property?.type||'Oficina';
}
ACT.newProperty=()=>propertyForm();ACT.editProperty=data=>propertyForm(S.properties.find(property=>property.id===data.id));
ACT.propertyTax=data=>{const property=S.properties.find(property=>property.id===data.id);if(property)taxForm(null,{name:'Impuesto predial / tasa - '+property.name,propertyId:property.id,propertyName:property.name,base:property.value,rate:property.rate,amount:r2(property.value*property.rate/100),frequency:'anual',period:String(new Date().getFullYear())})};
V.propiedades=()=>main(pageHead('Propiedades y contribuciones municipales','<button class="btn" data-a="newProperty">+ Propiedad</button>')+notice('Registra oficinas, bodegas o terrenos y su valor fiscal. Crea obligaciones para predial, rótulos o licencias; ajusta el concepto, monto y fecha conforme a tu municipio.')+accountingTable(['Propiedad','Tipo','Catastro','Valor fiscal','Tasa sugerida','Acciones'],S.properties.map(property=>`<tr><td>${esc(property.name)}</td><td>${esc(property.type)}</td><td>${esc(property.cadastral)}</td><td>${money(property.value)}</td><td>${esc(property.rate)}%</td><td>${actionButton('editProperty',property.id,'Editar')} ${actionButton('propertyTax',property.id,'Crear impuesto / tasa')}</td></tr>`).join(''))+`<h3 class="ledger-section">Obligaciones de propiedades</h3>`+accountingTable(taxHeaders,taxRows(S.taxes.filter(tax=>tax.propertyId))));
const originalPanel=V.panel;
V.panel=()=>{
  originalPanel();const pending=S.taxes.filter(tax=>taxBalance(tax)>0&&tax.due<=followingAlertDate());
  $('#main').insertAdjacentHTML('beforeend',`<section class="card accounting-hub"><h3>Operación contable</h3><p class="mut">Facturas, personal y obligaciones en un solo lugar.</p><div class="accounting-links">${[['kardex','📦','Cardex'],['cobrar','↙','Por cobrar'],['pagar','↗','Por pagar'],['personal','👥','Personal'],['nomina','💰','Nómina'],['fiscal','🗓️','Agenda fiscal']].map(([route,icon,label])=>`<button class="btn ghost" data-a="nav" data-r="${route}">${icon} ${label}</button>`).join('')}</div>${pending.length?`<p class="bad">${pending.length} obligación(es) vencidas o con vencimiento en los próximos 7 días.</p>`:''}</section>`);
};
function followingAlertDate(){const date=new Date();date.setDate(date.getDate()+7);return iso(date)}

function readFileData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file)})}
async function mutateReceipt(taxId,method,body={}){
  if(!await flush())throw new Error('Guarda los cambios pendientes antes de modificar comprobantes.');
  const companyId=CO.id;
  const operation=(async()=>{
    const result=await api('receipt?c='+encodeURIComponent(companyId)+'&tax='+encodeURIComponent(taxId),method,{...body,revision:REV});
    const tax=S.taxes.find(record=>record.id===taxId);if(tax){if(result.receipt)tax.receipt=result.receipt;else delete tax.receipt}
    REV=result.revision;
    if(cloudBase){const stored=cloudBase.taxes?.find(record=>record.id===taxId);if(stored){if(result.receipt)stored.receipt=copyCloud(result.receipt);else delete stored.receipt}}
    return true;
  })();
  receiptMutation=operation;
  try{return await operation}finally{if(receiptMutation===operation)receiptMutation=null;if(saveVersion>savedVersion)flush()}
}
ACT.uploadReceipt=data=>{
  modal('Adjuntar comprobante privado',notice('Un comprobante consolidado por obligación. PDF de hasta 1 MB; las fotos JPG, PNG o WebP se comprimen antes de subir. Límite: 100 archivos o 50 MB por empresa. No se publica una URL de acceso libre.')+`<label>PDF o foto<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></label>`,async form=>{
    const file=form.elements.file.files[0];if(!file)return 'Selecciona un archivo.';
    let encoded,mime,name=file.name;
    if(file.type==='application/pdf'){if(file.size>1048576)return 'El PDF debe pesar como máximo 1 MB.';encoded=await readFileData(file);mime=file.type}
    else {const image=await shrink(file,1600);encoded=image.split(',')[1];mime='image/webp';name=name.replace(/\.[^.]*$/, '')+'.webp'}
    if(encoded.length>1398104)return 'El archivo comprimido supera 1 MB. Reduce su tamaño e intenta de nuevo.';
    await mutateReceipt(data.id,'POST',{file:encoded,mime,name});view();
  },'Guardar comprobante');
};
ACT.downloadReceipt=async data=>{
  const companyId=CO.id,tax=S.taxes.find(record=>record.id===data.id);if(!tax?.receipt)return;
  const response=await fetch('/api/receipt?c='+encodeURIComponent(companyId)+'&tax='+encodeURIComponent(tax.id),{credentials:'same-origin'});
  if(!response.ok)throw new Error('No se pudo descargar el comprobante. Revisa tu sesión.');
  downloadFile(await response.blob(),tax.receipt.name);
};
ACT.deleteReceipt=async data=>{if(confirm('¿Retirar el archivo adjunto? El pago se conserva y el archivo sigue disponible en las últimas 30 versiones de respaldo.')){await mutateReceipt(data.id,'DELETE');view()}};
