// Contrato compartido por el esquema, el conversor y el script de migración.
export const collections = {
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
export const children = {
  lines: { table: 'journal_lines', text: ['a'], money: ['d', 'c'] },
  items: { table: 'invoice_items', text: ['p', 'unit'], money: ['u', 'cost'], numeric: ['q'] },
  stock: { table: 'inventory_movements', text: ['pid', 'unit'], money: ['unitCost'], numeric: ['q'] },
  payments: { table: 'invoice_payments', text: ['method'], money: ['amount'] },
};
export const snake = name => name.replace(/[A-Z]/g, char => '_' + char.toLowerCase());
