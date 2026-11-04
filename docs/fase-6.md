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

## Entrega actual: ítems 5–8 — análisis financiero

Esta entrega añadió los cuatro módulos solicitados, sin rehacer Presupuestos ni los reportes históricos de `analytics.js`. La sección anterior «No hecho» describe la entrega histórica; los ítems 5–8 quedaron implementados en esta ampliación. Los ítems 2–4 quedan fuera de esta solicitud.

- Indicadores financieros: DSO, DPO, DIO, ciclo de efectivo, márgenes bruto/neto, equilibrio, liquidez, endeudamiento, rotaciones de activos/inventario, EBITDA, flujo operativo libre, ROE/ROA. Período editable y comparación con período inmediatamente anterior de igual duración; explicación y unidades por indicador. Clasificación contable editable por prefijos para la empresa, perfil y sector configurados. Los perfiles orientados a servicios sin ventas inventariables omiten DIO, rotación de inventario y ciclo. No se inventan índices de referencia sectoriales.
- Costeo por actividades: costos por actividad en centavos y generadores editables en JSON, por cliente, producto, servicio, empleado y sucursal. Se toman ingresos y costos históricos de líneas de venta/notas de crédito; empleado identifica al operador registrado, no presume horas de trabajo ni atribuye empleados sin evidencia. El reparto usa aritmética entera y asigna el resto al último generador positivo. Cada dimensión es una vista alternativa: no sumar dimensiones ni usar un mismo gasto dos veces si ya está en costo directo. Los pools introducidos corresponden al período que se está analizando; al cambiarlo deben revisarse sus importes. No genera asientos.
- Tableros por rol: el servidor determina dueño, contador, cajero o vendedor; no acepta un rol del navegador. Solo incluye métricas con permiso de origen. Cajero/vendedor reciben sus propias ventas y el cajero sus arqueos autorizados. Dueño/contador reciben resultados y balances si también tienen Contabilidad y Finanzas. Sin permiso de origen, se omite la tarjeta.
- Notas y paquete de cierre: plantilla de texto editable, destinatario contador/banco, versión de configuración y auditoría de cada cambio. Paquete PDF y CSV con indicadores, estados resumidos (resultado, activos, pasivos y patrimonio), notas, empresa, período, fecha, autor, revisión, sucursal y aviso «verifica con tu contador». Es un informe interno, no certificación ni sustituto de estados firmados.

### Integración y seguridad

Permisos propios: `indicadores_financieros`, `costeo_abc`, `tableros_rol`, `notas_financieras`; inscritos en el catálogo común, matriz y bloqueo de planes. Los cuatro nacen apagados por sucursal. Solo el dueño activa/desactiva, con motivo y confirmación. Configuración y revisiones pasan por `runOperation/updateCompany`, operación UUID, revisión optimista, transacción y versiones recuperables existentes. Las fichas y eventos quedan en `businessRecords`, incluidos en respaldos y almacenamiento relacional vigente. El guardado genérico y `businessSave` no pueden modificarlas. El alcance se obtiene de la sucursal de sesión, nunca del cuerpo de solicitud. Soporte y empresas limitadas conservan solo lectura.

Indicadores y notas requieren además Contabilidad y Finanzas; ABC requiere Ventas, Inventario, Personal y Costos. Los reportes usan la proyección autorizada existente y auditan descargas. La API conserva mismo origen/JSON/sesión; no se añadieron rutas públicas. Las descargas CSV neutralizan fórmulas y todo contenido HTML se escapa. Los importes persistidos de actividades usan el campo ya declarado `amountCents`. No hubo tablas, migraciones, dependencias ni cambios de motor/históricos. Se añadió `public/financial-analysis.js`, manteniendo componentes, tema oscuro y adaptación móvil existentes, sin tocar `style.css`. Los textos usan `uiT`.

### Supuestos y límites de cálculo

Los saldos promedio usan apertura y cierre, no promedio diario. DSO usa ingresos totales; DPO aproxima compras con costo de ventas. No se anualizan ROE/ROA. Cero o divisor negativo produce «No disponible». EBITDA exige cuentas explícitas de depreciación, intereses e impuestos; equilibrio exige costos fijos y aproxima contribución con margen bruto. Flujo libre es una estimación indirecta con cuentas por cobrar, inventario, cuentas por pagar e inversión neta, sin otros ajustes de capital de trabajo; exige depreciación e inversión clasificadas. Antes de usarlo para un banco, revisar mapas, solapamientos, cuentas correctoras, clasificación fija/variable y ajustes con el contador. Sin costo histórico por línea, ABC muestra rentabilidad no disponible, sin usar costo actual de catálogo. No se modifican las reglas monetarias del motor contable; estos cálculos son exclusivamente de reporte.

### Evidencia y verificación

Se escribieron cuatro pruebas breves en `tests/financial-indicators.test.mjs`, `activity-costing.test.mjs`, `role-dashboards.test.mjs` y `financial-notes.test.mjs`: activación, divisores cero, reparto exacto, ausencia de mutación contable, aislamiento por operador, permiso de origen y versiones de notas. **No se ejecutaron**. Se comprobó sintaxis con `node --check` y formato con `git diff --check`; se actualizaron huellas mediante el script de recursos. No se ejecutaron servidor, compilaciones ni npm test; no hubo despliegue ni mezcla con principal.

La comprobación funcional corresponde a la plataforma: cuatro planes (incluidos bloqueos individuales), dueño/contador/cajero/vendedor con sin acceso/lectura/escritura, dos sucursales y consulta consolidada rechazada, soporte, empresas limitadas, concurrencia y reintento UUID, restauración de respaldo, RLS/rol real de Functions, importes cero/negativos/costos desconocidos, períodos cruzados, PDF multipágina, CSV y motivo en bitácora, teléfono/laptop y claro/oscuro. Reversión: desactivar cada módulo y conservar fichas/tablas/versiones; no borrar datos.
