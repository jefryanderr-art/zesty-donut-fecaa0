// Contrato compartido por el esquema, el conversor y el script de migración.
export const collections = {
  fiscalWorkflows: { table: 'fiscal_workflows', text: ['module','kind','branchId','period','status','parentId'], cents: ['amountCents','differenceCents'] },
  inventoryLayers: { table: 'inventory_layers', text: ['productId','branchId','epoch','entryId','sourceLayerId'], numeric: ['q','originalQuantity'], cents: ['unitCostCents','valueCents','originalValueCents'] },
  businessRecords: { table: 'business_records', text: ['module','kind','name','status','branchId','customerId','productId','entryId','resource','due'], money: ['total','principal','interest','penalty','paid','deposit','valuation','cost','price'], numeric: ['q','rate'] },
  branches: { table: 'branches', text: ['name','code','address','phone'] },
  accounts: { table: 'accounts', key: 'code', text: ['name', 'tipo', 'nat', 'sub'] },
  products: { table: 'products', text: ['name', 'code', 'unit'], money: ['cost', 'price'], numeric: ['stock', 'min'] },
  customers: { table: 'customers', text: ['name', 'taxId', 'status'], money: ['creditLimit'] },
  suppliers: { table: 'suppliers', text: ['name', 'taxId', 'currency'], money: ['creditLimit'] },
  employees: { table: 'employees', text: ['name', 'start', 'position'], money: ['salary'] },
  payrolls: { table: 'payrolls', text: ['employeeId', 'from', 'to', 'status', 'entryId'], money: ['base', 'overtime', 'bonus', 'commission', 'gross', 'tax', 'social', 'loan', 'net'] },
  settlements: { table: 'settlements', text: ['employeeId', 'entryId'], money: ['salary', 'vacations', 'severance', 'bonus', 'premium', 'total'] },
  taxes: { table: 'tax_obligations', text: ['name', 'due', 'period', 'source', 'entryId'], money: ['amount', 'base', 'credit', 'usedCredit', 'paid', 'withholdings', 'grossAdvance'] },
  properties: { table: 'properties', text: ['name', 'type', 'cadastral'], money: ['value'] },
  shifts: { table: 'shifts', text: ['operatorId', 'series', 'closedAt'], money: ['opening', 'expected', 'counted', 'difference'] },
  cashMovements: { table: 'cash_movements', text: ['entryId', 'currency', 'debit', 'credit', 'method'], money: ['total', 'baseTotal'] },
  pettyFunds: { table: 'petty_funds', text: ['name', 'account', 'responsible', 'entryId'], money: ['fixedAmount', 'authorizedAmount', 'limit'] },
  pettyVouchers: { table: 'petty_vouchers', text: ['fundId', 'account', 'accruedEntryId'], money: ['base', 'vat', 'total'] },
  cashCounts: { table: 'cash_counts', text: ['fundId', 'account'], money: ['expected', 'counted', 'vouchers', 'difference', 'authorizedFixedAmount'] },
  costCatalog: { table: 'cost_catalog', text: ['name', 'type', 'account', 'center'], money: ['amount'] },
  costs: { table: 'costs', text: ['entryId', 'catalogId', 'period', 'pay'], money: ['base', 'vat', 'total'] },
  entries: { table: 'journal_entries', text: ['type', 'desc', 'reference', 'due', 'party', 'pay', 'invoiceId', 'customerId', 'supplierId', 'shiftId'], money: ['subtotal', 'vat', 'total'] },
};
for (const name of ['entries','shifts','cashMovements','pettyFunds','pettyVouchers','cashCounts','costs','employees','payrolls','settlements','taxes']) collections[name].text.push('branchId');
Object.assign(collections, {
  withholdings: { table: 'withholdings', text: ['name','side','reference','invoiceId','entryId','branchId'], money: ['base','total'], numeric: ['rate'] },
  instruments: { table: 'instruments', text: ['name','kind','status','reference','due','invoiceId','entryId','branchId'], money: ['total'] },
  partners: { table: 'partners', text: ['name','branchId'] },
  stockTransfers: { table: 'stock_transfers', text: ['sourceId','destinationId','status','branchId','entryId'], money: ['total'] },
  assets: { table: 'fixed_assets', text: ['name','entryId','account','method','branchId'], money: ['cost','residual','accumulated'], numeric: ['lifeMonths'] },
  loans: { table: 'loans', text: ['name','entryId','account','branchId'], money: ['principal'], numeric: ['annualRate','months'] },
  recurringEntries: { table: 'recurring_entries', text: ['name','branchId'] },
  exchangeRates: { table: 'exchange_rates', text: ['currency','source'], numeric: ['rate'] },
  foreignDocuments: { table: 'foreign_documents', text: ['name','currency','side','entryId','branchId'], money: ['foreignAmount','baseTotal'], numeric: ['exchangeRate'] },
  budgets: { table: 'budgets', text: ['month','account','branchId'], money: ['total'] },
  quotations: { table: 'quotations', text: ['name','status','branchId'], money: ['total'] },
  purchaseOrders: { table: 'purchase_orders', text: ['name','status','branchId'], money: ['total'] },
  attendance: { table: 'attendance', text: ['employeeId','status','branchId'] },
  vacationRequests: { table: 'vacation_requests', text: ['employeeId','from','to','branchId'], numeric: ['days'] },
  employeeAdvances: { table: 'employee_advances', text: ['employeeId','entryId','branchId'], money: ['total'], numeric: ['months'] },
});
export const children = {
  lines: { table: 'journal_lines', text: ['a'], money: ['d', 'c'] },
  items: { table: 'invoice_items', text: ['p', 'unit'], money: ['u', 'cost'], numeric: ['q'] },
  stock: { table: 'inventory_movements', text: ['pid', 'unit'], money: ['unitCost'], numeric: ['q'] },
  payments: { table: 'invoice_payments', text: ['method'], money: ['amount'] },
};
export const snake = name => name.replace(/[A-Z]/g, char => '_' + char.toLowerCase());

// Metadatos de declaraciones y paquetes: valores monetarios nativos, nunca flotantes.
export const workflowCentFields=[...new Set([...Object.values(collections),...Object.values(children)].flatMap(d=>(d.money||[]).map(k=>k+'Cents'))),'debtCents','disposableCents','requiredCents','employerSocialCents','inatecCents','revaluationCents','debitCents','creditCents','closingCents','incomeCents','expenseCents','equityCents','assetsCents','liabilitiesCents','outputCents','inputCents','creditCents','advanceCents','adjustmentCents','taxableCents','penaltyCents','interestCents','paidCents','amountCents','differenceCents'];

// Defaults are additive: never replace an existing value or historical catalog.
export const initialAccounts=[['1101','Caja general','activo','D','ef'],['1102','Bancos','activo','D','ef'],['1201','Cuentas por cobrar','activo','D',''],['1301','Inventario de mercadería','activo','D',''],['1401','Mobiliario y equipo','activo','D','fijo'],['1402','Vehículos','activo','D','fijo'],['1403','Depreciación acumulada','activo','C','fijo'],
['2101','Cuentas por pagar','pasivo','C',''],['2102','Impuestos por pagar','pasivo','C',''],['2103','Sueldos por pagar','pasivo','C',''],['2201','Préstamos bancarios largo plazo','pasivo','C','fin'],
['3101','Capital social','patrimonio','C','fin'],['3102','Utilidades acumuladas','patrimonio','C',''],['3103','Retiros del propietario','patrimonio','D','fin'],
['4101','Ventas','ingreso','C',''],['4102','Otros ingresos','ingreso','C',''],['5101','Costo de ventas','costo','D',''],
['6101','Sueldos y salarios','gasto','D',''],['6102','Alquiler','gasto','D',''],['6103','Servicios básicos','gasto','D',''],['6104','Transporte','gasto','D',''],['6105','Publicidad','gasto','D',''],['6106','Depreciación','gasto','D',''],['6107','Otros gastos y mermas','gasto','D','']];
export const initialFiscal={vatRate:0,incomeRate:0,salaryTax:0,socialRate:0,daysPerMonth:30,overtimeFactor:1,workingHours:8,bonusDays:0,premiumDays:0,vacationDays:0,dismissalDays:0,resignationDays:0,delimiter:';',decimal:'.',exportColumns:'concepto,periodo,vencimiento,base,tasa,iva_cobrado,iva_acreditable,monto,pagado,saldo,estado'};
export function completeCompanyDocument(input,{name='',country='Nicaragua',cur='C$',ruc=''}={}) {
 const data=structuredClone(input||{});
 data.cfg ||= {};
 for(const [key,value] of Object.entries({name,invoiceCountry:country,cur,ruc,addr:''}))if(!Object.hasOwn(data.cfg,key))data.cfg[key]=value;
 data.cfg.fiscal={...initialFiscal,...data.cfg.fiscal};
 data.cfg.pos={useDimensions:(data.entries||[]).some(e=>e.costCenter||e.project),...data.cfg.pos};
 for(const key of [...Object.keys(collections),'moneyTransfers'])if(!Object.hasOwn(data,key))data[key]=[];
 if(!Object.hasOwn(data,'invoiceSequences'))data.invoiceSequences={};
 if(!input||!Object.hasOwn(input,'accounts'))data.accounts=initialAccounts.map(([code,name,tipo,nat,sub])=>({code,name,tipo,nat,sub}));
 if(!data.branches.length)data.branches=[{id:'principal',name:'Principal',code:'P',active:true,main:true,address:'',phone:''}];
 return data;
}

// Server-owned profile lifecycle metadata survives the residual codec and backups.
export const companyProfileFields=['profilePending','profileCompletedAt','profileChartPreserved'];
