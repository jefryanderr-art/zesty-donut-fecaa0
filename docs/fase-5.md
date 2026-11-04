# Fase 5: inventario avanzado

PEPS (F5.1) **no se implementó** por decisión del dueño; el costeo (promedio ponderado) no se tocó.

## Alcance
Cinco capacidades nuevas (AE–AI), grupo Inventario, **apagadas por defecto**, con permiso propio (Sin acceso / Lectura / Lectura y escritura) y bloqueables por plan (derivan del catálogo `public/profiles.js`; ningún perfil las incluye). El dueño activa cada una desde «Más módulos» con fecha de hoy, motivo y confirmación. Los registros son `businessRecords` (ya con tabla relacional, RLS, índice por empresa, respaldo JSON/ZIP, versiones y PDF completo): **sin migración ni tabla nueva**.

- **Bodegas (`bodegas`)**: bodegas/zona por sucursal, distribución de la existencia de la sucursal en bodegas, traslados entre bodegas (registro inmutable), mínimo/máximo con alerta y reposición sugerida (hasta el máximo; sin máximo, hasta el mínimo). Es **informativo**: no genera asientos ni cambia costos o el stock de la sucursal. La suma asignada no puede exceder la existencia; las ventas posteriores no actualizan las bodegas, y el informe muestra «sin asignar» (puede quedar negativo → reasignar).
- **Kits (`kits`)**: componentes, costo del kit y disponibilidad (componente limitante). **Límite (F5.3 sin cerrar):** vender un kit no descuenta sus componentes; hacerlo exige modificar `makeSale` y la validación Kardex. El kit se vende con el flujo actual (sus componentes como líneas).
- **Conteo cíclico (`conteo_ciclico`)**: plan por zona (bodegas de la zona) o categoría, con esperados congelados. El ajuste confirmado es el «Conteo físico» existente de Inventario; después se vincula el asiento al plan (solo si sus productos están dentro del alcance y no se usó antes). Si falla el vínculo, el ajuste ya existe y se puede vincular de nuevo.
- **Consignación y VNR (`consignacion_vnr`)**: consignaciones de proveedores (sin stock ni asiento) y reporte de valor neto realizable (mín(costo, precio − gastos de venta)); % de gastos de venta fijo en 0 (no editable aún). Solo reporte.
- **Desembarque (`desembarque`)**: una ficha por compra con varias facturas de gasto (centavos enteros, sin duplicar proveedor+factura) y reporte de costo puesto en bodega prorrateado por valor. No modifica el costo de los productos ni asientos.

## Permisos, sucursales y descargas
Cada operación (`netlify/lib/inventory-advanced.mjs`) pasa por `runOperation`/`updateCompany` (revisión, identificador de operación obligatorio, bloqueo, bitácora, versiones, transacción), exige permiso de escritura del módulo, además `inventario`/`compras`/`gastos` según el caso, sucursal del servidor, confirmación y motivo. Las fichas no se editan por el guardado genérico. Soporte temporal y empresas limitadas siguen en solo lectura por el mecanismo existente. `inventoryReport` valida permiso del módulo, usa la proyección de la sucursal activa, devuelve PDF/CSV con empresa, período, fecha, autor, sucursal y versión y registra «Descarga inventario avanzado». Cálculos puros en `public/advanced-math.mjs` y `netlify/lib/warehouse-stock.mjs`.

## Archivos existentes modificados
- `public/profiles.js`: 5 capacidades nuevas; ningún perfil las incluye.
- `netlify/lib/business.mjs`: estados/validación y rechazo del guardado genérico para los módulos nuevos.
- `netlify/lib/operations.mjs`: enrutamiento, ruta de informe y guardia de conservación; sin efecto si los módulos están apagados.
- `netlify/lib/accounting-codec.mjs`: `unitCostCents` como centavos nativos.
- `public/index.html`: script nuevo y huellas (`scripts/version-assets.mjs`).
- `tests/business-profiles.test.mjs`: conteo de capacidades 30 → 35.
Nuevos: `netlify/lib/inventory-advanced.mjs`, `netlify/lib/warehouse-stock.mjs`, `public/inventory-advanced.js`, `public/advanced-math.mjs`, `tests/inventory-advanced.test.mjs`, `tests/warehouse-stock.test.mjs`, `tests/advanced-math.test.mjs`.

## Límites y riesgos
La activación es por empresa (no por sucursal). Textos con `uiT('inventory.*')` sin entradas en `ui-text-catalog.mjs`. La guía del asistente no los menciona. No hay editor de consumo de kits ni de % de gastos de venta. Nada se ejecutó: **no verificado** (solo `node --check` y `git diff --check`).

## Reversión
Sin migraciones: apagar los módulos o quitar permiso/plan; los registros se conservan sin efecto.

## Comprobaciones posteriores al despliegue (pendientes)
1. Cuatro planes: los módulos aparecen/desaparecen según bloqueo; lectura vs escritura.
2. Colaboradores: Sin acceso / Lectura / Escritura; un usuario con solo `bodegas` y sin `productos` ve identificadores en lugar de nombres.
3. Soporte temporal y empresas limitadas: solo lectura, operaciones rechazadas.
4. Sucursales: bodegas, conteos y desembarques de una sucursal no aparecen en otra.
5. Flujos: asignar > existencia falla; traslado conserva el total; alertas; conteo + vínculo; consignación y VNR; desembarque con varias facturas.
6. PDF/CSV de cada módulo, bitácora y presencia en respaldo JSON/ZIP/PDF completo.
7. Teléfono y laptop, claro y oscuro, `.bnav` sin tapar contenido; RLS e índices de `businessRecords`; ejecutar los tres archivos de pruebas nuevos y `business-profiles`.
