// Contrato compartido por el esquema, el conversor y el script de migración.
export const collections = {
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
