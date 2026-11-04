# Fase 7: personal y nómina

Se completó el código del ítem 5, de menor riesgo: constancias de trabajo y de ingresos con textos editables y descargas PDF/CSV. Se escribieron pruebas; no se ejecutaron. La fase completa no está terminada.

- [ ] 1. Adelantos/préstamos y cuotas confirmadas: no se añadió interfaz ni descuento automático. El registro previo del servidor permanece; el cierre de nómina usa guardado general. Continuar con una operación de descuento y cierre atómico, evitando duplicación entre pestañas y validando reversas antes de habilitarlo.
- [ ] 2. Vacaciones: no se añadieron calendario, aprobación ni pasivo laboral. Continúan los registros históricos. Definir reglas editables y flujo de aprobación antes de conectarlos.
- [ ] 3. Planillas por sucursal/área: no se añadió una nueva planilla; permanece el informe anterior de costo de personal. Falta integrar provisiones y descargas auditadas.
- [ ] 4. Metas por tramos: el auxiliar previo permanece sin conexión activa. Falta configuración, validación y devengo explícito sin duplicar comisiones.
- [x] 5. Constancias: código, permisos, textos uiT, pruebas escritas y documentación incorporados; funcionamiento **no verificado**.
- [ ] 6. Parámetros por país: no se amplió la plantilla anterior. Falta catálogo sin valores laborales fijos y parámetros con vigencia, confirmación y validación.

El corte conservador entregó únicamente un ítem completo y mantuvo las demás ampliaciones sin código activo nuevo. No se alteraron nóminas pagadas, numeraciones, asientos ni reglas del motor contable. Los auxiliares históricos de advanced-math siguen sin conectarse a nuevos flujos.

## Alcance y límites

Constancias laborales está en Más módulos. Comienza apagado por sucursal. Solo el dueño, con escritura en Constancias laborales y Personal, configura ambos textos, activa o desactiva, confirma e indica motivo. La operación usa runOperation/updateCompany: revisión, identificador idempotente, transacción, bitácora y respaldos existentes. La configuración tiene versión e historial de motivos; las versiones completas se conservan mediante el respaldo existente. Guardados generales y operaciones genéricas de negocio no pueden cambiarla.

Las consultas y descargas requieren lectura en ambos módulos y plan que los permita. El permiso propio ofrece Sin acceso / Lectura / Lectura y escritura mediante el catálogo existente. Personal también limita roles y planes. Soporte temporal y empresas limitadas mantienen solo lectura. Se exige una sucursal del servidor y no se acepta la del navegador como autorización; el consolidado queda excluido. Los endpoints entregan únicamente selección de nombres y datos del empleado requerido, sin documento de identidad, cuentas bancarias ni números de seguridad social.

Ingresos significa percepciones **brutas** de nóminas pagadas según fecha de pago inclusiva; excluye pendientes, adelantos y liquidaciones. Se suman en centavos seguros en accounting-math; no se recalculan salarios ni tasas históricos y se rechazan fracciones de centavo. No constituye certificación oficial ni asesoría laboral: verifica con tu contador. Los importes descargados se identifican explícitamente como centavos y moneda. La constancia de trabajo no expone ingresos.

El texto es literal, sin HTML ni variables; se escapa en los formularios. PDF y CSV incluyen empresa, sucursal, período, fecha, generador, versión del formato y del texto. Ambas descargas registran auditoría antes de devolver datos: el evento acredita la solicitud autorizada, no que el navegador guardó el archivo. CSV protege fórmulas. No hay firma digital, envío externo, almacenamiento de PDF ni numeración nueva. Se reutilizan las librerías locales. Los controles usan los estilos existentes, sin modificar style.css ni agregar CSS. Responsive, oscuro y separación de .bnav requieren comprobación visual.

## Persistencia, migración y reversión

Migraciones: **ninguna**. La configuración usa businessRecords en Netlify Database, con su tabla, índice por empresa, RLS, codec, filtrado de sucursal, respaldo y versiones existentes. No se agregaron campos monetarios persistidos: incomeCents es una proyección efímera calculada en el servidor. No se modificó esquema ni migración aplicada. Desactivar conserva datos y bloquea nuevas descargas; una reversión debe conservar documentos, filas y versiones.

## Archivos

Nuevos: netlify/lib/employment-certificates.mjs, public/employment-certificates.js y tests/employment-certificates.test.mjs.

Modificados: public/accounting-math.mjs añadió solo la suma pura de ingresos; netlify/lib/operations.mjs incorporó rutas protegidas y guardas; netlify/lib/business.mjs validó y reservó configuración; public/profiles.js incorporó el permiso y ruta al catálogo; public/business.js agregó textos editables del acceso; public/ui-texts.js y public/ui-text-catalog.mjs incorporaron uiT; public/index.html cargó el módulo. netlify/lib/assistant-guide.mjs añadió instrucciones sin datos de empleados. public/analytics.js y public/operations.js cambiaron únicamente huellas de dependencias; docs/avance-mejoras.md y este documento registraron el alcance. scripts/version-assets.mjs actualizó URL de caché sin compilar.

## Comprobaciones

Pruebas escritas: apagado, activación, motivo y confirmación, restricciones de dueño/soporte/límite, ambos permisos, separación de sucursal, versiones, desactivación sin borrar, selección de empleado, período, suma solo de pagos, rechazo de fracciones y contrato de integración. No se ejecutaron pruebas, servidor, build ni npm test.

Tras el despliegue, **no verificado**: permisos reales con los cuatro planes y colaboradores (sin acceso/lectura/escritura), soporte y empresas limitadas; sesión y origen; activación por sucursal; revisión vencida e idempotencia concurrente; bloqueo de guardado genérico; filtrado entre empresas/sucursales; PDF largo con tildes; CSV con fórmulas; ingresos por fecha y nóminas históricas; auditoría; respaldo/restauración relacional y RLS usando el rol real de Functions; teléfono, laptop, oscuro y .bnav. Comprobar conservación de datos al desactivar. Riesgos: confundir bruto con neto, texto laboral incorrecto y formatos visuales aún sin verificar.

Verificación ligera realizada: `node --check` pasó en cada JS/MJS modificado o nuevo, incluidas las pruebas escritas. `git diff --check` pasó. Esto acredita sintaxis y formato, no ejecución de pruebas ni funcionamiento.
