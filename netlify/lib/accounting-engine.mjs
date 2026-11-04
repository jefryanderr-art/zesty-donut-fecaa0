import '../../public/annual-ledger.js';
export const accountingEntries=(entries,through='9999')=>globalThis.AcontecAnnualLedger.select(entries,through);
// Un único contrato matemático para servidor, simuladores y pruebas.
export * from '../../public/accounting-math.mjs';
