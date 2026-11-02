# Editor de plataforma, transferencias y respaldos privados

Esta entrega añadió componentes sobre el frontend estático y los servicios existentes. No renombró archivos base ni introdujo compilación, credenciales, proveedores externos o tokens en el navegador. Las cuatro migraciones nuevas son aditivas; las migraciones aplicadas se conservaron.

## Contenido y apariencia

El catálogo contiene 1.905 campos estáticos con texto original, grupo y máximo de caracteres. `t(clave, original)` conserva el valor anterior cuando no existe edición. Los textos se escapan al generar HTML; los valores técnicos de los selectores se conservaron aunque cambie su etiqueta. El catálogo no convierte nombres de empresas, documentos, precios ni datos del cliente en contenido editorial. Pagadito y los documentos legales conservan sus editores y textos propios. La cobertura de cadenas dinámicas, atributos de accesibilidad y las pantallas completas todavía requiere completar una revisión exhaustiva; esta entrega no acredita que todas las cadenas visibles sean editables.

Editor de plataforma permite buscar textos, consultar el original y restaurarlo individualmente o en conjunto. Conserva borrador y publicación separados en `acontec_site_content`, con revisión optimista, historial de publicaciones y restauración a borrador. Restaurar no publica automáticamente. Solo ADMIN_EMAIL, con rol real de plataforma y sin sesión de colaborador, puede utilizar la API editorial. La vista previa mantiene sus cambios en memoria y no los publica.

La apariencia incorpora colores para fondo, tarjetas, texto, texto secundario, bordes y acentos; fuente cerrada, radio opcional, logo claro, logo oscuro y favicon WebP. Los valores vacíos mantienen la presentación existente. La validación exige contraste mínimo 4.5:1 para texto principal/secundario frente a fondo/tarjetas; quedan pendientes comprobaciones de botones, acentos y todos los estados interactivos. Las imágenes del sitio público mantienen la excepción pública existente.

El menú permite etiquetas, iconos, grupos, orden y ocultación de presentación, sin conceder permisos ni cambiar operaciones. Se añadieron secciones públicas para beneficios, cómo funciona, planes activos, preguntas frecuentes y contacto, con orden y visibilidad, además de título y descripción SEO. La portada y el contacto reutilizan los bloques actuales. Los planes se leen de Database y el ahorro compara el precio anual con doce mensualidades. El SEO se aplica en el navegador; no se añadió renderizado de metadatos en servidor para rastreadores que no ejecuten JavaScript.

## Transferencias

La configuración bancaria y de WhatsApp se guarda en un documento nuevo, privado y apagado por defecto. Cambiarla exige motivo, confirmación y escribir CONFIRMAR COBROS. La API pública de configuración no incluye cuentas ni WhatsApp de cobros.

La opción secundaria se añade al final del resumen existente mediante un módulo separado. `billing.js`, Pagadito, sus webhooks y las funciones programadas originales no se editaron. El inicio de checkout añade únicamente una comprobación de canal; un fallo técnico de lectura no bloquea por sí solo a un cliente nuevo.

El servidor prepara una referencia y una cotización en estado borrador. Confirmar después de transferir la convierte en solicitud pendiente antes de ofrecer el enlace a WhatsApp. La referencia conserva plan, periodo, moneda, cambio fechado y entorno; una petición abierta se reutiliza. Solicitar no modifica acceso ni prueba. Las solicitudes pendientes vencen a los siete días. La cola admite aprobación con importe recibido y referencia bancaria, rechazo con motivo y registro administrativo sin solicitud previa. Una diferencia de importe exige confirmación adicional. Referencia bancaria única por entorno, bloqueo de filas y revisiones impiden una segunda aprobación.

La aprobación reutiliza el motor de confirmación, recibos y asientos de los pagos existentes dentro de una sola transacción. Extiende desde la fecha pagada si todavía es futura, sin prorrateo. Una transferencia en córdobas conserva su moneda en el pago y recibo; el asiento USD utiliza explícitamente el cambio fechado guardado y registra su conversión en auditoría. Sandbox conserva su marca y no genera ingresos contables reales.

Los canales históricos se inicializan por migración. Un disparador asigna Pagadito con el primer pago confirmado y consume la autorización de cambio correspondiente, conservando idempotencia de confirmaciones repetidas. El administrador puede autorizar un cambio una sola vez; pasar a Transferencia exige cancelar y conciliar los checkouts recurrentes abiertos. Los datos contables y límites se comparten entre canales.

El control de acceso sigue usando entitlement en cada petición contable. La tarea nueva solo vence solicitudes, prepara recordatorios tres días antes y el día de vencimiento, exporta respaldos y procesa correo. No reactiva ni sobrescribe suspensiones manuales. Ajustar suscripción conserva el motivo y deja una marca administrativa. El Centro de control añade filtros de canal/estado y pago del mes en el entorno activo; los CSV/PDF existentes ya separan método, moneda y entorno. El estado SMTP existente permanece visible; una fila en cola no acredita entrega.

## Almacenamiento y respaldos

Se separaron tamaño de documentos vigentes, versiones, comprobantes privados referenciados y exportaciones nuevas. Los comprobantes se deduplican por clave usando referencias vigentes y versiones. La medición no representa todos los bytes físicos de Database o Blobs: no incluye índices ni archivos huérfanos o imágenes históricas sin atribución por empresa. Las imágenes referenciadas se miden mediante lectura del objeto y caché de tamaño en Database; las imágenes públicas del sitio se atribuyen a plataforma. Los comprobantes del servicio se muestran por cuenta, separados del total por empresa. No se movieron, borraron o migraron archivos previos para medirlos. Completar la atribución de archivos sin referencias históricas es trabajo pendiente, no una verificación posterior ya resuelta por el código.

Los planes admiten un umbral informativo opcional; permanece sin límite por defecto. El aviso al 70 % compara documentos vigentes más comprobantes e imágenes referenciados, excluyendo los documentos de versiones y las exportaciones. No bloquea consultas, guardados ni operaciones. El panel del dueño y el control administrativo muestran las mediciones disponibles. La duración de prueba permanece en 24 horas hasta guardar otro valor; solo afecta suscripciones que se inicialicen después.

El administrador puede exportar una empresa manualmente a Blobs y descargar la copia mediante sesión y contexto de plataforma. La exportación JSON comprimida con gzip contiene el documento, metadatos de perfil y versiones; conserva referencias de archivos, pero no incorpora los binarios de comprobantes o imágenes. No sustituye el respaldo ZIP existente. Las copias usan claves por empresa y fecha. Solo las empresas propias del administrador se exportan automáticamente, aproximadamente cada siete días. Las empresas de clientes solo tienen exportación manual. El registro conserva las últimas cinco copias y una antigüedad máxima de 30 días; la eliminación física de copias retiradas ocurre en el siguiente mantenimiento diario y solo afecta este almacén nuevo. Nunca sobrescribe datos originales.

## Comprobaciones realizadas y pendientes

Se consultó el estado de migraciones antes de generar el esquema nuevo. Se revisaron estáticamente sintaxis, rutas, escapes, controles administrativos, transacciones, claves privadas y separación por entorno. Se compararon los archivos originales de Pagadito y no presentaron diferencias. No se ejecutaron pruebas, servidores ni compilaciones locales. Estas comprobaciones no acreditan funcionamiento.

PENDIENTE tras desplegar:

- Aplicación de migraciones, disparadores, RLS y rol real de Functions. Sesión ausente, colaborador, dueño normal, administrador fuera de contexto y aislamiento entre empresas.
- Guardar borrador, vista previa, publicar, historial, restaurar y conflicto 409 entre pestañas. Comprobar contenidos vacíos, máximos, HTML y scripts rechazados; confirmar que empresas, permisos y datos conservan sus valores. Completar cobertura residual de textos.
- Apariencia en teléfono, laptop, teclado y oscuro; contraste de botones, formularios y estados; logos, favicon, secciones reordenadas, SEO y navegación de los 26 perfiles. No dar por aprobada la compatibilidad móvil por contener media queries.
- Sandbox: preparar referencia, solicitar transferencia, abrir WhatsApp, aprobar, rechazar, vencer solicitud, repetir aprobación y referencia bancaria, aprobar monto distinto, registrar pago sin solicitud y forzar conflicto de suscripción. Probar córdobas, USD y cambio fechado; comparar recibo, vigencia y asiento.
- Cliente Pagadito intentando transferencia; cliente Transferencia intentando checkout; cuenta Sin asignar y fallo técnico de lectura; autorización única de cambio en ambas direcciones y rechazo con recurrencias abiertas. Repetir webhooks/retornos anteriores y confirmar Pagadito exactamente como antes.
- Bloqueo por vencimiento y gracia con la aplicación abierta, suspensión y reactivación manual, extensión de fecha y mantenimiento posterior sin deshacer la decisión administrativa. Revisar filtros, mes de pago y exportaciones por canal/moneda/entorno.
- Recordatorios deduplicados, SMTP ausente y envío SMTP confirmado. Revisar cuotas y guía del asistente sin transmitir datos bancarios o contables.
- Descargar una copia manual propia y de cliente, validar aislamiento, contenido, revisión concurrente y conservación del original. Comprobar periodicidad solo de empresas propias, cinco copias/30 días y limpieza del almacén nuevo; ningún archivo histórico debe eliminarse.
- Contrastar las mediciones de bytes con Database y Blobs, completar imágenes y comprobantes no atribuibles y comprobar el aviso al 70 % sin bloquear operaciones. Revisar duración de pruebas nuevas conservando las existentes.
