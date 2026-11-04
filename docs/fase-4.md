# Fase 4: cumplimiento fiscal con prudencia

No se confirmó el estado vigente de la facturación electrónica de la DGI de Nicaragua y **no se asumió ningún requisito**. Se construyó arquitectura preparada; no se afirma certificación, validez fiscal ni formatos oficiales. Todas las reglas son editables y deben revisarse con el contador («verifica con tu contador»).

## Alcance

Tres módulos nuevos, apagados por defecto, con permiso propio (Sin acceso / Lectura / Lectura y escritura) y bloqueables por plan (se derivan del catálogo compartido `public/profiles.js`): **Cumplimiento fiscal** (AB), **Retenciones y constancias** (AC) y **Checklist de cierre** (AD). Se abren desde «Más módulos». El dueño los activa por sucursal con fecha efectiva de hoy, motivo y confirmación. Los registros son `businessRecords` (ya con tabla relacional, RLS, índice por empresa, respaldo JSON/ZIP, versiones y PDF completo); **no hay migración ni tabla nueva**.

- **F4.1 Proveedor fiscal** (`netlify/lib/fiscal-provider.mjs`): interfaz preparar / firmar-enviar / consultar / anular. Solo existe «manual DGI»: número y fecha fiscal se escriben a mano; sin ellos el documento queda con la marca DOCUMENTO NO FISCAL y no puede emitirse. No hace llamadas externas; «emitido», «aceptado» o «rechazado» son anotaciones manuales del usuario, no consultas a la DGI. Estados y transiciones: borrador→emitido/anulado, emitido→aceptado/rechazado/anulado, rechazado→borrador/anulado, aceptado→anulado, con historial por transición (actor, fecha, motivo). Anular el estado fiscal **no revierte la contabilidad**: se corrige con nota de crédito. Un proveedor externo exigiría credenciales en variables de Netlify y otra fase; queda sin implementar.
- **F4.2 Validaciones**: RUC/cédula obligatorio desde un monto (centavos), campos requeridos, máscara de numeración (A = letra, 9 = dígito; sin expresiones regulares del usuario). Se evalúan al preparar/emitir el documento fiscal y, solo si el dueño activa «aplicar al emitir facturas nuevas», también al emitir la factura (`sale`).
- **F4.3 Numeración fiscal** (riesgo alto): rangos por serie y sucursal, sin traslapes ni reducción por debajo de lo emitido. El interruptor «bloquear fuera de rango» está apagado por defecto, solo actúa hacia adelante, exige confirmación y motivo y queda en la bitácora. Con él activo, emitir sin rango autorizado o fuera de rango se bloquea; la alerta de agotamiento se muestra en la vista. Los saltos se calculan desde las facturas ya emitidas; no se modifica ninguna numeración ni se recalcula nada histórico.
- **F4.4 Retenciones**: sobre las retenciones existentes (`withholding`), el módulo muestra acumulados mensual/anual por tercero, registra constancias con número escrito a mano (una vigente por retención), cifras de declaración manuales (centavos) y el cruce mensual con el anticipo (`taxes`) y la declaración. No se genera numeración oficial ni se calcula la declaración.
- **F4.5 Libros de apoyo**: ventas, compras y retenciones con columnas configurables; PDF y CSV; aviso «formato de trabajo, no oficial homologado».
- **F4.6 Plantillas de país**: `public/country-templates.js` concentra los valores de Nicaragua que antes estaban en `country.js` (mismos números). El dueño puede guardar plantillas por país (IVA, etiquetas, renta por tramos, aportes, calendario), validadas con la validación laboral existente. Guardarlas **no** las aplica a nóminas ni a facturas; la aplicación laboral sigue por «Plantilla Nicaragua». El calendario de Nicaragua se entrega vacío para no inventar fechas.
- **F4.7 Checklist de cierre** (riesgo alto): mensual o anual con siete ítems (conciliaciones, depreciación, provisiones, revaluación, IVA, retenciones, nómina), estado y nota por ítem. Solo el dueño cierra un checklist completo de un período terminado. Con el interruptor «bloquear período al cerrar» (apagado), el cierre usa el bloqueo existente `cfg.periodLocks` (reabrible desde Control de períodos). Los ítems son manuales.

## Permisos, sucursales y descargas

Cada operación valida sesión, membresía, plan, permiso del módulo (escritura), sucursal del servidor y, cuando toca datos fiscales/facturación, el permiso `fiscal`/`facturacion`. Se ejecutan por `runOperation`/`updateCompany` (revisión optimista, identificador de operación obligatorio, bloqueo, bitácora y versiones, transacción única). Soporte temporal y empresas limitadas siguen solo en lectura por el mecanismo existente. Los informes (`fiscalReport`) requieren permiso del módulo y, para retenciones y libros, permiso `fiscal`; usan la proyección de la sucursal activa. PDF y CSV incluyen empresa, período, fecha, autor, sucursal y versión y registran «Descarga fiscal» en la bitácora. Los módulos no se pueden editar por el guardado genérico.

## Archivos existentes modificados y por qué no cambia su comportamiento

- `public/profiles.js`: tres capacidades nuevas; ningún perfil las incluye, así que no aparecen en menús existentes.
- `public/country.js`: toma la referencia de Nicaragua de la plantilla compartida (valores idénticos).
- `public/index.html`: dos scripts nuevos y huellas de caché (`node scripts/version-assets.mjs`).
- `netlify/lib/business.mjs`: estados, validación y rechazo del guardado genérico para los módulos nuevos.
- `netlify/lib/operations.mjs`: enrutamiento de operaciones e informe fiscal; la guardia de emisión no hace nada mientras el módulo esté apagado (devuelve `null` sin leer ni escribir datos) y no altera el cálculo de números.
- `netlify/lib/period-controls.mjs`: permite el cambio de bloqueos desde `fiscalPeriodClose`, solo cuando el dueño activó el interruptor.
- `netlify/lib/accounting-codec.mjs`: tres nombres de centavos nativos más.
- `tests/business-profiles.test.mjs`: el conteo de capacidades pasó de 23 a 30 (el valor anterior ya no coincidía con las 27 capacidades existentes).

Archivos nuevos: `netlify/lib/fiscal-provider.mjs`, `fiscal-rules.mjs`, `fiscal-compliance.mjs`, `public/fiscal.js`, `public/country-templates.js`, `tests/fiscal-compliance.test.mjs` y este documento.

## Límites y riesgos

- Sin proveedor externo, sin envío a la DGI, sin XML/firma, sin formatos oficiales y sin cálculo de declaraciones.
- Con el interruptor de rangos activo, una serie sin rango autorizado deja de emitir; revisar antes de activarlo. Los cajeros no necesitan permiso de lectura del módulo para quedar sujetos al bloqueo.
- El checklist y el cierre dependen de la disciplina del usuario; no verifican por sí mismos conciliaciones ni asientos.
- Los textos usan `uiT('fiscal.*', texto base)`; no se añadieron entradas a `ui-text-catalog.mjs`/`ui-texts.js`, por lo que no hay traducciones editables aún.
- No se actualizó `assistant-guide.mjs` (la guía de ayuda no menciona estos módulos).
- Nada de esto se ejecutó: **no verificado** (sin servidor, compilación ni `npm test`). Solo `node --check` y `git diff --check`.

## Reversión

No hay tablas ni migraciones. Para revertir se apagan los tres módulos (o se retira el permiso/plan): los registros se conservan y no tienen efecto. Los bloqueos de período creados por un checklist se reabren desde Control de períodos. No se eliminan datos.

## Comprobaciones posteriores al despliegue (pendientes)

1. Cuatro planes: el módulo aparece/desaparece según el bloqueo del plan; Pro y planes limitados respetan lectura.
2. Colaboradores: Sin acceso / Lectura / Escritura por módulo; sin lectura de `fiscal` no hay libros ni retenciones. Un cajero sin permiso sigue bloqueado por el rango cuando el interruptor está activo.
3. Soporte temporal y empresas limitadas: solo lectura; las mutaciones se rechazan.
4. Sucursales: rangos y checklist por sucursal; un usuario restringido solo ve la suya.
5. Emisión: con todo apagado, ventas idénticas a antes; con rango activo, bloqueo fuera de rango y salto auditado; validación de RUC sobre monto.
6. Documento fiscal: borrador→emitido sin número falla; con número se emite; anulación no cambia asientos.
7. Retenciones: acumulados y cruce con anticipo/declaración; una constancia por retención.
8. Checklist: no cierra incompleto; con interruptor, el bloqueo aparece en Control de períodos y se puede reabrir.
9. Descargas PDF/CSV de cada módulo y libros; bitácora «Descarga fiscal»; respaldo JSON/ZIP y PDF completo incluyen los registros.
10. Teléfono y laptop, tema oscuro, barra `.bnav` sin tapar contenido; RLS e índices de `businessRecords`; ejecutar `tests/fiscal-compliance.test.mjs`.
