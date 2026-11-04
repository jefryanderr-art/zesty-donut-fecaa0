import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../public/advanced-math.mjs';

test('kit: costo y disponibilidad por componente limitante', () => {
  const k = m.kitSummary([{ qty: 2, unitCostCents: 150, stock: 9 }, { qty: 1, unitCostCents: 400, stock: 10 }]);
  assert.deepEqual(k, { costCents: 700, available: 4 });
  assert.throws(() => m.kitSummary([{ qty: 0 }]));
});
test('desembarque prorrateado conserva el total', () => {
  const r = m.landedCost([{ costCents: 1000 }, { costCents: 2000 }], [100, 51]);
  assert.equal(r.reduce((s, l) => s + l.landedCents, 0), 3151);
});
test('VNR: sin deterioro si el precio supera el costo (falso positivo)', () => {
  assert.equal(m.netRealizableValue({ qty: 3, unitCostCents: 100, priceCents: 200 }).writeDownCents, 0);
  assert.equal(m.netRealizableValue({ qty: 3, unitCostCents: 100, priceCents: 90, sellingCostCents: 10 }).writeDownCents, 60);
});
test('indicadores: divisor cero devuelve null', () => {
  const r = m.ratios({ sales: 0, cogs: 0, receivables: 1, payables: 1, inventory: 1, currentAssets: 2, currentLiabilities: 1, liabilities: 1, equity: 1, assets: 2, netIncome: 1 });
  assert.equal(r.dso, null); assert.equal(r.current, 2); assert.equal(r.cashCycle, null);
  assert.equal(m.breakEvenCents(1000, 0.5), 2000);
});
test('comisión por tramos', () => {
  const t = [{ from: 0, rate: 1 }, { from: 100000, rate: 3 }];
  assert.equal(m.tierCommissionCents(50000, t), 500);
  assert.equal(m.tierCommissionCents(100000, t), 3000);
});
test('vacaciones y cuotas', () => {
  assert.equal(m.vacationBalance({ monthsWorked: 12, taken: 10, monthlySalaryCents: 3000000 }).days, 20);
  const q = m.installments(1001, 3); assert.equal(q.reduce((a, b) => a + b), 1001);
});
test('presupuesto: alerta solo sobre el umbral', () => {
  assert.equal(m.budgetVariance(1000, 1050).alert, false);
  assert.equal(m.budgetVariance(1000, 1200).alert, true);
});
