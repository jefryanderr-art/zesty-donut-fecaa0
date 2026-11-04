import test from 'node:test';
import assert from 'node:assert/strict';
import { stockByWarehouse, stockAlerts, transferMovements } from '../netlify/lib/warehouse-stock.mjs';

test('existencias por bodega suman movimientos con signo', () => {
  const s = stockByWarehouse([
    { warehouseId: 'a', productId: 'p', qty: 10 },
    { warehouseId: 'a', productId: 'p', qty: -4 },
    { warehouseId: 'b', productId: 'p', qty: 3 },
  ]);
  assert.equal(s.find((r) => r.warehouseId === 'a').qty, 6);
  assert.equal(s.find((r) => r.warehouseId === 'b').qty, 3);
});

test('alerta bajo mínimo sugiere reponer hasta el máximo; sin máximo, hasta el mínimo', () => {
  const stock = [{ warehouseId: 'a', productId: 'p', qty: 2 }];
  assert.equal(stockAlerts(stock, [{ warehouseId: 'a', productId: 'p', min: 5, max: 20 }])[0].suggested, 18);
  assert.equal(stockAlerts(stock, [{ warehouseId: 'a', productId: 'p', min: 5 }])[0].suggested, 3);
});

test('falso positivo: dentro de rango no genera alerta; sobre máximo es informativa', () => {
  const ok = [{ warehouseId: 'a', productId: 'p', qty: 10 }];
  assert.deepEqual(stockAlerts(ok, [{ warehouseId: 'a', productId: 'p', min: 5, max: 20 }]), []);
  const over = stockAlerts([{ warehouseId: 'a', productId: 'p', qty: 30 }], [{ warehouseId: 'a', productId: 'p', min: 5, max: 20 }]);
  assert.equal(over[0].type, 'above_max');
  assert.equal(over[0].suggested, 0);
});

test('traslado exige bodegas distintas y existencia suficiente', () => {
  const stock = [{ warehouseId: 'a', productId: 'p', qty: 5 }];
  assert.throws(() => transferMovements({ fromWarehouseId: 'a', toWarehouseId: 'a', productId: 'p', qty: 1, stock }));
  assert.throws(() => transferMovements({ fromWarehouseId: 'a', toWarehouseId: 'b', productId: 'p', qty: 9, stock }));
  const mv = transferMovements({ fromWarehouseId: 'a', toWarehouseId: 'b', productId: 'p', qty: 2, stock });
  assert.equal(mv[0].qty + mv[1].qty, 0);
});
