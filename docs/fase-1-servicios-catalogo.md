# Fase 1: ampliación del catálogo y sector económico (parcial)

> Actualización 2026-11-04: este documento describe la entrega inicial. La implementación posterior de Q, plantillas especializadas, reposición y devengo opcionales está en [Cierre de Fase 1](fase-1-cierre-mejoras.md). Su verificación funcional no se ha ejecutado; el estado de la solicitud completa está en [avance-mejoras.md](avance-mejoras.md).


Esta entrega continuó la primera parte descrita en `servicios-y-modelos.md`. No rehízo sus perfiles, navegación ni exclusiones de trazabilidad. La Fase 1 **no quedó completa**: la capacidad Q, sus prorrateos, ingresos diferidos, renovaciones y métricas siguen pendientes. No se iniciaron las fases 2–9, conforme a la condición de terminar cada fase antes de avanzar. Los contratos existentes no sustituyen Q.

## Alcance incorporado

Editar un servicio sin activar la ampliación conserva el formulario anterior. El botón **Configurar características del servicio** abre la configuración opcional. Cada guardado requiere permiso de Inventario, sucursal seleccionada, motivo y confirmación. La activación solo afecta ventas futuras; las facturas conservan sus líneas y las nuevas conservan una instantánea independiente de la definición utilizada. Un servicio no recibe stock ni costo inventariable.

La configuración incluye duración estándar en minutos (cero significa sin duración), cobro por hora, sesión, mes, visita o servicio; IVA gravado, exento con motivo o tasa cero; comisión general en puntos básicos enteros y excepciones por empleado. Las excepciones requieren Personal y empleados existentes de la sucursal. No se interpreta una tasa cero histórica como exención. Los parámetros y su justificación no acreditan validez fiscal: **verifica con tu contador**.

Los paquetes contienen solo servicios, sin autorreferencias, repeticiones ni paquetes anidados. El precio, IVA y comisión utilizados son los del paquete; no se suman precios ni se facturan por separado los componentes. Un componente con características activadas puede aportar consumibles. No se convierte ningún producto histórico en servicio.

Los consumibles son artículos inventariables explícitos. Al emitir una factura se confirman la prestación y su consumo. El servidor suma la demanda de líneas repetidas, componentes y mercadería vendida; resta reservas en consignación y valida el stock libre de la sucursal de la sesión. Una cantidad de prestación que produciría menos de una milésima o fracciones de milésima de insumo se rechaza, sin redondeo silencioso. Los saldos históricos de stock conservan sus seis decimales existentes.

En la misma transacción se guarda la factura y un asiento gestionado separado, `servicio-consumo`, vinculado por identificador. Este descuenta los insumos y debita 5101 contra 1301 al costo vigente, con centavos enteros calculados en el módulo matemático compartido. El servicio continúa con costo y stock propios iguales a cero. La separación evita que el ajuste final de una nota de crédito reponga insumos ya utilizados o revierta su costo como si fueran mercadería devuelta. Cualquier corrección de una prestación o consumo erróneo requiere revisión y operación compensatoria documentada; no se añadió reversión automática del consumo.

La comisión se calcula sobre la base sin IVA después del descuento. La factura puede asociarse a un empleado cuando existe permiso de Personal; de otro modo conserva la comisión general como referencia interna. Las instantáneas no devengan ni pagan comisiones ni agregan descuentos de nómina. La proyección oculta excepciones individuales e importes por empleado a quienes no pueden leer Personal. El guardado genérico conserva esas excepciones sin permitir su inyección ni borrado.

En **Ajustes y respaldo → Sector económico y plantilla contable**, el dueño puede seleccionar uno de siete sectores. No se selecciona por inferencia ni se cambian impuestos, cuentas, indicadores o documentos al elegirlo. La vista previa muestra dos cuentas sugeridas adicionales por sector. Aplicarlas requiere además escritura en Contabilidad, versión de plantilla vigente, confirmación y ausencia de asientos, stock, nóminas y documentos extranjeros en toda la empresa, incluidas otras sucursales. Las cuentas existentes conservan su nombre; una naturaleza incompatible impide aplicar la plantilla. No se reemplaza el catálogo base. La referencia conserva sector, perfil de empresa y versión; aún no existe un catálogo exhaustivo de plantillas especializadas por cada perfil ni indicadores sectoriales nuevos.

## Persistencia, permisos y recuperación

`serviceDefinition` utiliza los metadatos existentes de productos. Las instantáneas y el consumo utilizan los registros contables y movimientos existentes. El sector y la referencia de plantilla utilizan configuración. No se agregaron tablas, columnas ni colecciones: el esquema, el adaptador, la dimensión de sucursales y sus índices/RLS existentes siguen siendo la fuente de persistencia. Por ello esta parte no generó una migración SQL ni modificó las aplicadas; **no constituye el cierre ni la migración final de la Fase 1 solicitada**.

Los precios y totales principales siguen en las columnas BIGINT existentes. Los importes residuales nuevos `costCents`, `totalCents`, `baseCents` y `commissionCents` se declararon en el codec como centavos enteros seguros; tasas y cantidades conservan su significado. No se almacenan importes monetarios nuevos como decimales en metadatos.

`POST /api/operations` incorpora `serviceDefinition` y `economicSector` dentro de `runOperation/updateCompany`; ambas exigen identificador idempotente. Las ventas con definiciones activas también lo exigen. Se reutilizan sesión, JSON, mismo origen, membresía, permisos y plan del servidor, bloqueo de empresa, revisión optimista, sucursal de sesión, auditoría, versiones y sincronización transaccional. Soporte y empresas limitadas siguen siendo de lectura. El consolidado no admite estas operaciones. No se confía en una sucursal enviada por el navegador. La configuración genérica no puede alterar definiciones, sector ni referencia de plantilla.

Las nuevas propiedades entran en JSON, ZIP y PDF completo mediante los exportadores existentes: productos y configuración se recorren completos, y los asientos incluyen sus metadatos y stock. No se añadió otro informe ni listado de resultados; las tablas nuevas son editores y la vista previa de configuración. La restauración del dueño puede recuperar estas configuraciones por el endpoint existente, con sus permisos completos, revisión y controles de documentos gestionados. No permite modificar facturas contabilizadas ni eludir bloqueos de período. La restauración integral de documentos que ya rechaza el sistema sigue fuera del alcance.

## Revisión de compatibilidad por archivo

- `netlify/lib/operations.mjs`: añadió operaciones y validaciones para campos explícitos. Sin definiciones activas, el emisor devuelve el mismo documento, importes, costo e inventario anteriores. Los cálculos y numeraciones existentes no se reemplazaron. Los controles de restauración solo admiten las configuraciones nuevas para el dueño en la ruta protegida.
- `netlify/lib/access.mjs`: proyectó los campos personales nuevos y preservó los ocultos al guardar. No cambió roles, sesiones, consultas de empresas ni la política comercial.
- `netlify/lib/accounting-codec.mjs`: reconoció los cuatro nombres monetarios nuevos en centavos. No cambió el formato ni las columnas monetarias previas.
- `netlify/functions/api.mjs`: habilitó la recuperación de estas configuraciones únicamente dentro de la restauración ya autorizada; el guardado normal conserva su bloqueo.
- `public/accounting-math.mjs`: añadió dos funciones puras de costo y comisión con enteros/BigInt. Las funciones matemáticas anteriores no se modificaron.
- `public/index.html`: cargó los dos scripts adicionales y actualizó huellas, conservando nombres, orden previo y frontend sin compilación.
- `public/ui-texts.js` y `public/ui-text-catalog.mjs`: añadieron textos editables; conservaron los textos previos.
- `public/assistant.js` y `netlify/lib/assistant-guide.mjs`: actualizaron instrucciones locales sobre la configuración explícita. No se añadieron herramientas, datos contables al asistente, modelos ni llamadas a proveedores.
- `public/analytics.js` y `public/operations.js`: solo actualizaron la huella de la dependencia matemática local mediante el script de recursos.
- `tests/service-sales.test.mjs`: incorporó las nuevas dependencias puras al arnés del emisor real; conservó sus casos anteriores.

Los archivos nuevos fueron `public/service-catalog.js`, `public/economic-sectors.js`, `netlify/lib/service-catalog.mjs`, `netlify/lib/economic-sector.mjs` y sus dos archivos de pruebas. No se modificaron `style.css`, `profiles.js`, `business.js`, datos reales, migraciones, dependencias, credenciales, Pagadito ni tareas programadas. Los formularios reutilizan clases existentes y escapan contenido. No se incorporó almacenamiento del navegador ni nuevas peticiones periódicas. No se midió ahorro de créditos.

## Comprobaciones y estado de verificación

Se revisó estáticamente el diff, las importaciones y las rutas de guardado, proyección y respaldo. Se ejecutaron `node --check` en los archivos JavaScript modificados y nuevos, `node scripts/version-assets.mjs` y `git diff --check`. No se ejecutaron pruebas unitarias o funcionales, npm test, servidores, compilaciones, migraciones, envíos ni pagos. La sintaxis no acredita funcionamiento. La validación funcional, visual, de Database/RLS y de concurrencia permanece **no verificada**.

Las pruebas preparadas cubren activación optativa; permisos, confirmación y motivo; duración, IVA/exención y comisiones; empleados; paquetes inválidos; consumibles y reservas; cantidades; comisiones en centavos; instantáneas independientes; proyección sin Personal; preservación relacional; emisor real con consumo; precisión histórica del stock; nota de crédito real sin reposición; selección de sector sin cambios contables; plantilla aditiva; restricciones por movimientos en otras sucursales; versión y naturaleza incompatibles. No se consideran aprobadas.

Después del despliegue de vista previa quedan pendientes:

1. Ejecutar los tests preparados mediante la plataforma. Comparar ventas de servicios históricos y mercadería con la versión anterior, incluyendo IVA, descuentos autorizados, notas de crédito y numeración.
2. Probar cada plan con dueño, contador y colaboradores sin acceso, lectura y escritura; repetir con Personal bloqueado, soporte y empresa limitada. Probar también peticiones API directas y campos personales inyectados.
3. Abrir y guardar un servicio sin activar características; confirmar el editor anterior, sus precios, unidades, IVA y códigos. Activar y desactivar sin modificar facturas previas. Verificar que la configuración individual no desaparece desde una sesión sin Personal.
4. Facturar servicio simple, paquete y venta mixta con consumo: stock exacto, reservas, faltante, saldo fraccionario, costo, asiento vinculado, fecha cerrada y notas de crédito parciales/finales. Probar también contratos/proyectos con consumo y la confirmación del servidor.
5. Dos pestañas y solicitudes simultáneas: una sola operación, factura y consumo, revisión en conflicto, identificador reutilizado con otro cuerpo y rechazo de stock insuficiente sin escrituras parciales.
6. Seleccionar sector con movimientos sin alterar cuentas. Intentar plantilla con movimientos ocultos en otra sucursal, stock o cuentas incompatibles; confirmar su rechazo atómico. Aplicar en empresa vacía y repetir sin duplicar cuentas.
7. Exportar JSON/ZIP y PDF completo; comprobar metadatos, centavos, instantáneas, sector y referencias. Restaurar configuraciones como dueño con los permisos completos; confirmar que documentos gestionados, sucursales y cierres siguen protegidos.
8. Revisar teléfono, tableta, laptop y PC, claro/oscuro, teclado, foco, texto largo y contenido malicioso; comprobar el último control frente a `.bnav`.

La rama y los commits quedaron a cargo del espacio administrado autorizado. No se realizaron commits ni despliegues manuales. Para revertir, desactivar características antes de retirar la interfaz y conservar metadatos, asientos y respaldos; una prestación ya contabilizada no se elimina. Volver a código anterior requiere revisar que conserve los campos nuevos antes de permitir escrituras.
