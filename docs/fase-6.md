# Fase 6: contabilidad, control y análisis (entrega parcial)

## Hecho (ítem 1: Presupuesto vs real)
- Módulo `presupuestos` (capacidad AJ, grupo Finanzas), **apagado por defecto**: el dueño lo activa con fecha de hoy, motivo, confirmación y umbral de alerta.
- Presupuestos por cuenta, centro de costo, proyecto o sucursal, en centavos enteros, con versiones (cada revisión conserva la anterior) y archivo sin borrar datos.
- Informe de presupuesto vs real con alerta de desviación (`budgetVariance`, `budgetActuals` en `public/advanced-math.mjs`), descarga PDF/CSV con empresa, período, fecha, autor y versión; queda en bitácora.
- Permiso propio `presupuestos` (bloqueable por plan, solo lectura para soporte/empresas limitadas por las reglas existentes). Datos en `businessRecords`, por lo que entran al respaldo.
- Real: por cuenta, saldo natural de los asientos del año; por centro/proyecto/sucursal, solo cuentas 5xxx/6xxx. No se recalculan ni modifican asientos.
- Archivos: `netlify/lib/budgets.mjs`, `public/budgets.js`, `tests/budgets.test.mjs`; modificados `business.mjs`, `operations.mjs`, `advanced-math.mjs`, `profiles.js`, `index.html`.

## Migración
Ninguna: se usa la colección `businessRecords` existente (RLS e índice por empresa ya vigentes).

## No hecho (sin código activo, motivo: alcance/créditos)
Ítems 2 a 8 (reclasificaciones con flujo y bloqueo de períodos, eliminaciones intercompañía, activos avanzados, indicadores por sector, ABC, tableros por rol, notas y paquete de cierre). Siguiente paso sugerido: el ítem 5 usando `ratios` y `breakEvenCents`, con el mismo patrón de módulo apagado.

## Límites
Informe interno; no es asesoría fiscal: verifica con tu contador. Las cifras de la interfaz se muestran en centavos. La tabla de presupuesto usa el catálogo `accounts` para validar cuentas.

## Comprobaciones manuales (pendientes tras el despliegue)
1. Sin activar, el módulo no permite crear; solo el dueño activa.
2. Crear, revisar (versión 2) y archivar; verificar desviación con alerta.
3. Colaborador sin permiso: sin acceso; con lectura: solo consulta y descarga.
4. Descargas PDF/CSV y entrada en bitácora; tema oscuro y móvil.
5. Sucursales: cada presupuesto pertenece a la sucursal activa.

No verificado: no se ejecutaron pruebas, servidor ni compilación.
