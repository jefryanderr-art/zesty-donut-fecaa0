// Lógica pura de existencias por bodega, alertas mínimo/máximo y reposición sugerida (F5.2).
// Sin efecto: no está conectada a operaciones, rutas ni pantallas. No modifica costos ni asientos.
// Las cantidades son enteros o decimales de inventario; no hay importes monetarios aquí.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Suma movimientos {warehouseId, productId, qty} (qty con signo) en existencias por bodega/producto. */
export function stockByWarehouse(movements = []) {
  const out = new Map();
  for (const m of movements) {
    if (!m || !m.warehouseId || !m.productId) continue;
    const key = `${m.warehouseId}|${m.productId}`;
    const row = out.get(key) || { warehouseId: m.warehouseId, productId: m.productId, qty: 0 };
    row.qty = Math.round((row.qty + num(m.qty)) * 1e6) / 1e6;
    out.set(key, row);
  }
  return [...out.values()];
}

/**
 * Alertas y reposición sugerida. limits: [{warehouseId, productId, min, max}].
 * - below_min: existencia < min → sugerir (max - existencia), o (min - existencia) si no hay máximo.
 * - above_max: existencia > max (solo informativo).
 * - negative: existencia < 0.
 */
export function stockAlerts(stock = [], limits = []) {
  const qtyOf = new Map(stock.map((s) => [`${s.warehouseId}|${s.productId}`, num(s.qty)]));
  const alerts = [];
  for (const l of limits) {
    const key = `${l.warehouseId}|${l.productId}`;
    const qty = qtyOf.get(key) ?? 0;
    const min = l.min == null ? null : num(l.min);
    const max = l.max == null ? null : num(l.max);
    if (qty < 0) alerts.push({ ...pick(l), type: 'negative', qty, suggested: 0 });
    if (min != null && qty < min) {
      const target = max != null && max >= min ? max : min;
      alerts.push({ ...pick(l), type: 'below_min', qty, suggested: Math.max(0, target - qty) });
    } else if (max != null && qty > max) {
      alerts.push({ ...pick(l), type: 'above_max', qty, suggested: 0 });
    }
  }
  return alerts;
}

const pick = (l) => ({ warehouseId: l.warehouseId, productId: l.productId });

/** Un traslado entre bodegas de la misma sucursal: valida y devuelve los dos movimientos. */
export function transferMovements({ fromWarehouseId, toWarehouseId, productId, qty, stock = [] }) {
  const q = num(qty);
  if (!fromWarehouseId || !toWarehouseId || fromWarehouseId === toWarehouseId) throw new Error('Bodegas no válidas.');
  if (!(q > 0)) throw new Error('Cantidad no válida.');
  const available = num(stock.find((s) => s.warehouseId === fromWarehouseId && s.productId === productId)?.qty);
  if (available < q) throw new Error('Existencia insuficiente en la bodega de origen.');
  return [
    { warehouseId: fromWarehouseId, productId, qty: -q },
    { warehouseId: toWarehouseId, productId, qty: q },
  ];
}
