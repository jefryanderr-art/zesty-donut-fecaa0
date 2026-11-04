// Cálculos puros de las Fases 5–7 (sin efecto: no están conectados a operaciones ni pantallas).
// Dinero en centavos enteros. No cambia el motor contable. Cifras orientativas: verifica con tu contador.
const int = (v) => (Number.isSafeInteger(v) ? v : 0);

/** F5.3 Kit: costo (centavos) y stock vendible a partir de componentes [{qty, unitCostCents, stock}]. */
export function kitSummary(components = []) {
  if (!components.length) return { costCents: 0, available: 0 };
  let costCents = 0, available = Infinity;
  for (const c of components) {
    if (!(c.qty > 0)) throw new Error('Cantidad de componente inválida.');
    costCents += Math.round(c.qty * int(c.unitCostCents));
    available = Math.min(available, Math.floor((c.stock ?? 0) / c.qty));
  }
  return { costCents, available: Math.max(0, available) };
}

/** F5.6 Costo puesto en bodega: compra + gastos de desembarque prorrateados por valor (resto al último). */
export function landedCost(lines = [], expensesCents = []) {
  const extra = expensesCents.reduce((s, v) => s + int(v), 0);
  const base = lines.reduce((s, l) => s + int(l.costCents), 0);
  let left = extra;
  return lines.map((l, i) => {
    const share = i === lines.length - 1 ? left : base ? Math.floor((extra * int(l.costCents)) / base) : 0;
    left -= share;
    return { ...l, landedCents: int(l.costCents) + share };
  });
}

/** F5.5 Valor neto realizable por producto: min(costo, precio estimado - gastos de venta); informativo. */
export function netRealizableValue({ qty, unitCostCents, priceCents, sellingCostCents = 0 }) {
  const nrv = int(priceCents) - int(sellingCostCents);
  const unit = Math.min(int(unitCostCents), nrv);
  return { unitCents: unit, totalCents: Math.round(qty * unit), writeDownCents: Math.max(0, Math.round(qty * (int(unitCostCents) - unit))) };
}

/** F6.5 Indicadores. Entradas en centavos; días en 365. Devuelve null si el divisor es 0. */
export function ratios({ sales, cogs, receivables, payables, inventory, currentAssets, currentLiabilities, liabilities, equity, assets, netIncome }) {
  const d = (a, b) => (b ? a / b : null);
  const dso = d(receivables * 365, sales), dpo = d(payables * 365, cogs), dio = d(inventory * 365, cogs);
  return {
    dso, dpo, dio,
    cashCycle: dso != null && dpo != null && dio != null ? dso + dio - dpo : null,
    grossMargin: d(sales - cogs, sales), netMargin: d(netIncome, sales),
    current: d(currentAssets, currentLiabilities), debt: d(liabilities, assets),
    roe: d(netIncome, equity), roa: d(netIncome, assets),
  };
}
export const breakEvenCents = (fixedCents, marginRatio) => (marginRatio > 0 ? Math.ceil(fixedCents / marginRatio) : null);

/** F7.4 Comisión por meta con escala por tramos [{from, rate}] (tasa % sobre el total alcanzado). */
export function tierCommissionCents(salesCents, tiers = []) {
  const t = [...tiers].filter((x) => x.rate >= 0).sort((a, b) => b.from - a.from).find((x) => salesCents >= x.from);
  return t ? Math.round((salesCents * t.rate) / 100) : 0;
}

/** F7.2 Saldo de vacaciones: devengados (días/mes) - tomados; pasivo = días * salario diario (centavos). */
export function vacationBalance({ monthsWorked, daysPerMonth = 2.5, taken = 0, monthlySalaryCents = 0 }) {
  const days = Math.round((monthsWorked * daysPerMonth - taken) * 100) / 100;
  return { days, liabilityCents: Math.max(0, Math.round((days * monthlySalaryCents) / 30)) };
}

/** F7.1 Cuotas de adelanto/préstamo: partes enteras, el resto va a la primera cuota. */
export function installments(totalCents, n) {
  if (!Number.isInteger(n) || n < 1 || !(totalCents > 0)) throw new Error('Cuotas inválidas.');
  const base = Math.floor(totalCents / n), rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? rest : 0));
}

/** F6.1 Desviación presupuesto vs real; alerta si supera el umbral (%). */
export function budgetVariance(budgetCents, actualCents, thresholdPct = 10) {
  const diff = actualCents - budgetCents;
  const pct = budgetCents ? (diff / budgetCents) * 100 : null;
  return { diffCents: diff, pct, alert: pct != null ? Math.abs(pct) > thresholdPct : diff !== 0 };
}
