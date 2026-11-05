# Suscripciones, organizaciones y personalizado

Esta continuación leyó `contexto-factura-y-rondas.md` y conservó los circuitos anteriores. Se trabajó en suscripciones, organizaciones y personalizado, en ese orden. No es una automatización completa de todos los puntos solicitados.

## Suscripciones de clientes

La suscripción del negocio que usa Acontec sigue siendo distinta de estos planes de servicio. Se reutilizaron las suscripciones, facturas a crédito, anticipos, notas de crédito, IVA e ingreso diferido anteriores.

El catálogo por sucursal define precio base fijo, precio adicional por uso entero o escalones marginales, periodicidad de 1/3/6/12 meses, límite entero de uso, días de prueba, preaviso de cancelación, intervalo entre gestiones de cobranza y umbral de suspensión. Los escalones deben cubrir el límite. Las condiciones se copian al alta: cambiar el catálogo no modifica clientes anteriores. La prueba excluye sus días del importe base, sin borrar su uso registrado. El precio base es positivo; no se añadieron planes de precio base cero.

El uso se registra en un período abierto, con motivo, sin superar el límite ni modificar períodos facturados. El límite controla las unidades registradas de esta suscripción, no concede ni revoca accesos a la plataforma Acontec ni mide recursos externos.

Cambiar plan en un período **aún no facturado** reparte su precio por días entre los planes vigentes. El uso total del período se valora con cada tarifa y se pondera por los días de cada tramo; no se mide consumo diario. Cambiar mensual/anual requiere un límite de período y conserva los límites anteriores. Los precios históricos no se reescriben.

**El ajuste automático de un período ya facturado quedó pendiente.** El servidor bloquea cambios de plan sobre facturas afectadas y pausa/cancelación con prorrateo de los nuevos planes facturados. Debe esperarse al siguiente período para continuar con estas operaciones; las notas ordinarias pueden corregir documentos, pero no habilitan por sí solas el reemplazo automático de un período. Las suscripciones clásicas conservan su corrección anterior por pausa/cancelación. Tampoco se implementaron cambio mensual/anual a mitad del período, cancelación programada ni cargo de penalización por cancelación.

Vista previa calcula base, IVA y total con el mismo motor compartido. Los cupones del plan tienen código, porcentaje y fecha final inclusiva. Se verifica la coincidencia exacta del descuento y su vigencia; cada descuento, también sin cupón, consume la autorización normal de un uso, con contraseña, roles, máximo y auditoría. No se añadieron cupones de un solo uso ni descuentos perpetuos automáticos. Cada emisión sigue confirmada y a crédito. Un período de prueba sin importe no genera factura; se elige el siguiente período facturable.

La cobranza permite registrar recordatorios e intentos fallidos separados por el intervalo configurado. El dueño puede suspender al alcanzar el umbral de días vencidos, si no afecta servicio ya facturado. Se conserva motivo e identificación de facturas. Son gestiones manuales: **no hay cobro por pasarela, reintentos automáticos ni envío de mensajes**. Los pagos se registran en Cuentas por cobrar. La mora muestra antigüedad de deuda; **no se añadieron intereses o recargos monetarios de mora**. Los avisos no se afirman entregados.

El historial incorpora cargos, abonos/correcciones y saldo por suscripción, con asignaciones contables por factura. MRR/ARR reflejan precio base vigente dividido por meses y excluyen componentes variables y descuentos de una emisión; no son ingreso contable reconocido ni una previsión neta completa. La retención es el complemento del churn de la cohorte activa inicial. No se añadieron cohortes de retención por mes ni pronósticos. El reconocimiento confirmado de los nuevos planes contempla los días de prueba y tramos de precio.

## Organizaciones

La nueva vista de Aportes requiere además lectura de Contabilidad para los informes. Sin ese permiso permanece la vista anterior. El dueño crea padrón de socios/donantes, campañas/fondos con meta, eventos vinculados al fondo y equipos de voluntarios/comités con integrantes del padrón. Los socios admiten edición de nombre, nota y estado activo; sus condiciones de cuota quedan fijas al alta. No se añadieron importación masiva, gestión de actividades de voluntariado ni reasignación retroactiva de aportes por nombre.

Las cuotas mensuales, trimestrales, semestrales o anuales se calculan desde la fecha de inicio. Un importe cero deja un donante libre. Registrar aporte distingue cuota por índice (0 es la primera) y aporte libre (índice vacío), permite parciales y rechaza exceder el saldo de cuota. No se cobra ni se reconoce ingreso al mostrar una cuota vencida; solo al confirmar el aporte se registra su asiento contra dinero e ingreso. Las cuotas se conservan al inactivar al socio; todavía no hay una baja efectiva que detenga cuotas futuras. Los atrasos son avisos internos consultables.

Los recibos tienen identificador del aporte, donante, fondo y asiento. La constancia anual resume aportes confirmados y saldo de cuotas a cierre del año consultado. No es un certificado de deducibilidad fiscal ni se envía automáticamente. El informe distingue ingreso y gasto por fondo y por evento, incluye reversas de costos por referencia al asiento original y compara ingresos acumulados con la meta. No es conciliación bancaria, presupuesto de fondos restringidos ni balance patrimonial completo. Los gastos reutilizan el catálogo de Costos y sus validaciones. Los aportes históricos siguen accesibles y no se vinculan automáticamente por nombre al padrón nuevo. No se añadió reversa específica de un aporte nuevo; cualquier corrección contable requiere revisión administrativa.

## Personalizado

Personalizar mi sistema mantiene la selección de visibilidad de **todas** las capacidades del catálogo y añade un modelo operativo validado en servidor entre los perfiles existentes. Permite abrir herramientas especializadas de comercio o servicios sin cambiar el tipo Personalizado. Se puede cambiar el modelo conservando módulos visibles y datos anteriores; solo el dueño guarda esta configuración, con revisión. Los planes, permisos, sucursales y soporte siguen aplicándose.

**Hay un modelo de formularios especializados activo a la vez**, no activación simultánea independiente de todos los formularios sectoriales. Se alterna el modelo para usar las herramientas específicas de otro rubro. Los módulos genéricos, Suscripciones y Aportes pueden combinarse. Los registros de negocio nuevos guardan su modelo y las validaciones de facturación de servicios lo conservan. El comportamiento completo al alternar modelos sobre fichas de varios sectores sigue pendiente de validación funcional. No se transformó inventario ni se relajaron los permisos del plan.

## Persistencia y verificación

Se reutilizaron `businessRecords`, asientos y metadatos residuales en Netlify Database, sin cambio de esquema ni migraciones. Los nuevos importes usan `amountCents`, `unitCents`, `targetCents` y otros nombres de centavos ya declarados. Las operaciones conservan revisión optimista, identificador idempotente, transacción de empresa, permisos, plan, sucursal de sesión, versiones y auditoría. No se añadieron secretos, proveedores ni persistencia local.

Se prepararon casos para la plataforma sobre tramos de precio, prueba, escalones, límites, períodos mensual/anual, rechazo de cambios sobre facturas, cuotas parciales, reversas por fondo y configuración personalizada. **No se ejecutaron pruebas, servidores ni compilaciones locales.** La comprobación estática no demuestra funcionamiento desplegado.

Pendiente después del despliegue: ejecutar casos nuevos y regresión de recurrentes clásicos; verificar RLS, autorización por propietario/colaborador/plan/sucursal/consolidado/soporte, concurrencia y repetición de solicitudes, descuentos y cupones con permisos y bloqueo de contraseña, notas y reconocimiento diferido, asignaciones de cobros, mora/suspensión/preaviso, documentos sin caché, respaldos/restauración y centavos residuales, cuotas y recibos, fondos/eventos/reversas, impresión, móvil, teclado y modo oscuro, y alternancia de modelos especializados. Los puntos marcados como pendientes funcionales de alcance arriba no se presentan como entregados.
