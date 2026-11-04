# Fase 3: facturación, cobranza y comunicación

Se incorporaron cuatro módulos optativos: Comunicación con clientes, Gestión de cobranza, Términos de pago y Próximas facturas. Se accede desde Más módulos, con los permisos propios Sin acceso, Lectura y Lectura y escritura y bloqueo configurable por plan. Cada módulo comienza sin configuración y sin efecto. Solo el dueño lo activa por empresa y sucursal, con fecha efectiva de hoy en Managua, motivo, confirmación, revisión y auditoría. No se inició otra fase.

## Alcance y decisiones conservadoras

### F3.1 Documentos y comunicación

Comunicación permite revisar y enviar facturas, cotizaciones, proformas y estados de cuenta al correo registrado del cliente, con PDF adjunto. La plantilla de asunto y cuerpo usa `{empresa}`, `{cliente}`, `{documento}` y `{fecha}`. Se conserva una instantánea del documento y del mensaje, destinatario e identificador de cola en el registro autorizado. Las cotizaciones clásicas sin cliente permiten seleccionar explícitamente el destinatario al preparar el envío: esto no añade un cliente al documento histórico ni lo modifica. Las proformas se toman de Documentos de venta. No se envían costos internos ni contabilidad ajena al documento.

El envío se incorpora a `acontec_service_messages` dentro de la misma transacción de `updateCompany`. La clave de operación protege reintentos HTTP; la clave única de cola incluye empresa y registro. La columna de correo existente conserva al dueño registrado para respetar su clave foránea; el destinatario final se guarda en el cuerpo privado y se valida de nuevo antes de SMTP. Se usa la entrega existente de `service-mail.mjs`, sin nueva tarea ni sondeo. SMTP ausente deja la solicitud en cola. La interfaz distingue pendiente, aceptado por SMTP, error definitivo y envío en curso/ambiguo. Aceptación SMTP no significa lectura ni entrega final a bandeja.

Los errores definitivos de estos documentos no se reintentan automáticamente. El usuario confirma el reintento; los estados enviados o ambiguos no admiten reintento desde la interfaz. Se conservan los intentos anteriores en el historial de reintento. Un timeout ambiguo exige revisión del servidor SMTP fuera de esta herramienta, sin afirmar entrega. El comportamiento previo del correo de plataforma y comprobantes de suscripción se conserva. Los mensajes privados de clientes se excluyen del listado de plataforma.

WhatsApp abre `wa.me` con teléfono validado y mensaje codificado. No usa API, no envía ni adjunta archivos automáticamente; la vista explica cómo descargar y adjuntar el PDF manualmente. Las descargas de documento y listados incluyen PDF y CSV para Excel.

### F3.2 Cobranza

El dueño configura hasta doce desplazamientos únicos de -365 a +365 días respecto al vencimiento. Generar propuestas no encola correos. Se incluyen reglas vencidas aún no gestionadas, incluso si la generación se hace después de su fecha; el usuario decide cuáles aprobar. Cada combinación factura/desplazamiento se propone una sola vez; el rechazo conserva la gestión y no provoca otra propuesta idéntica. Cambiar reglas no borra decisiones previas.

Aprobar un recordatorio exige escritura en Cobranza, Comunicación y Facturación, Comunicación activa y deuda todavía pendiente. Encola un estado de cuenta actualizado. El historial de cada propuesta registra aprobación o rechazo y vincula el envío. Las promesas guardan fecha, centavos y nota; las gestiones son registros adicionales inmutables y ninguna reduce deuda. El estado de cuenta incorpora facturas, notas y abonos, incluidas líneas asignadas por factura, con corte en la fecha seleccionada. El historial se filtra por cliente y período; las políticas vigentes se conservan visibles aunque su creación sea anterior al período.

El límite adicional por cliente se aplica en el emisor central, también al facturar Q y Contratos. El dueño elige advertencia con confirmación explícita o bloqueo. Cero significa no permitir nuevo crédito. Se calcula sobre deuda de la sucursal activa, porque la configuración es por sucursal y no autoriza acceso a otras. El límite histórico del cliente continúa siendo vinculante: la nueva advertencia no permite sobrepasarlo. Activar estas políticas implica conceder lectura del módulo correspondiente a quienes emiten esas facturas; el servidor exige ese permiso y no revela una política oculta.

### F3.3 Términos y descuentos

El dueño configura condiciones por cliente y sucursal para facturas nuevas a crédito: días netos, plazo de descuento, puntos básicos y cuenta existente de gasto financiero. Se guarda una copia de condiciones en la factura nueva; cambios posteriores no recalculan documentos emitidos. No se añaden condiciones a documentos históricos.

Se eligió descuento financiero sobre la base de la factura, sin modificar IVA. El ejemplo 2/10 n/30 usa 200 puntos básicos, 10 días de descuento y 30 días netos. El cálculo compartido usa enteros y BigInt para el producto y redondeo a centavo. Solo se concede al liquidar todo en el primer cobro dentro del plazo. Un cobro parcial no obtiene descuento y cierra la elegibilidad de cobros posteriores; una nota o reducción previa también la cierra conservadoramente. Nunca se duplica el descuento. El servidor exige vista previa vigente y orden cronológico; debita Caja general/Banco por lo recibido y gasto financiero por el descuento y acredita Cuentas por cobrar por el importe extinguido. Requiere Facturación, Términos, Contabilidad y responsable de Caja autorizado. Los cobros ordinarios previos siguen disponibles y no conceden este descuento tácitamente. Revertir cobro exige motivo, confirmación, permisos contables y de caja y responsable autorizado; crea líneas opuestas y conserva el cobro original, rechaza una segunda reversa y respeta la cronología y los saldos de caja. Una reversa no recupera la elegibilidad de descuento, para evitar aplicaciones repetidas. Verifica con tu contador el tratamiento financiero y tributario antes de usarlo.

### F3.4 Próximas emisiones

El dueño vincula explícitamente fichas existentes de Q o Contratos, sin convertirlas ni crear cargos. La vista calcula períodos aún no facturados entre fechas y omite orígenes sin permiso, pausados, suspendidos, finalizados o cancelados. Abrir módulo de origen conduce a su vista previa y emisión confirmada existentes; conserva los controles de período, idempotencia, anticipos y numeración originales. No existe emisión por calendario, consulta, correo ni tarea programada.

## Persistencia, seguridad y respaldos

No se necesitó cambio de esquema ni migración: `businessRecords` ya tiene tabla relacional con empresa, sucursal, fecha, RLS e índices por empresa. Se amplió el catálogo de módulos, su validador y las claves de centavos nativos del conversor residual (`limitCents`, `payableCents`, `unitCents`, `subtotalCents`, `vatCents`). Las políticas y la instantánea comercial conservan centavos enteros. Las colecciones y dimensiones existentes incluyen los nuevos registros en JSON, ZIP, versiones y PDF completo autorizado. La cola conserva su RLS e índice existentes; no se cambió su FK, ni se añadieron secretos a datos.

`POST /api/operations` mantiene sesión, JSON y mismo origen. `clientReport` valida empresa, membresía, plan y permiso del módulo, Facturación y sucursal del servidor; cotización/proforma requieren además Documentos de venta. Los reportes calculan sobre los documentos de esa sucursal y devuelven solo la proyección comercial, sin libro completo. Las mutaciones usan `runOperation`/`updateCompany`, bloqueo de empresa, revisión optimista, UUID y hash de operación, transacción única, auditoría y versiones. Las operaciones genéricas no pueden modificar registros de estos módulos ni documentos gestionados. Soporte y empresas limitadas permanecen en lectura. No se añadió conexión SQL al navegador ni almacenamiento de sesiones o conversaciones.

Los listados y documentos se descargan por solicitudes PDF/CSV auditadas con empresa, fechas, responsable, fecha de generación, sucursal y versión. La información de configuraciones en esos listados corresponde a políticas vigentes; el período filtra las gestiones. Las plantillas se interpretan como texto, no como HTML ejecutable. La interfaz usa `uiT` y los catálogos editoriales, `esc`, tarjetas/tablas/formularios existentes y sus contenedores adaptables. No se modificó `style.css`, colores, variables ni estilos.

## Compatibilidad de archivos existentes modificados

- `public/profiles.js`: añadió módulos al catálogo, sin activar capacidades de perfiles históricos.
- `public/business.js`: añadió traducción editorial de nombres y ayudas de esos módulos; conservó navegación, permisos y rutas previos.
- `public/accounting-math.mjs`: añadió una función pura de descuento financiero; no cambió funciones contables existentes ni su motor.
- `netlify/lib/operations.mjs`: integró operaciones e informes nuevos y guardas genéricas; el emisor solo añade condiciones/límites cuando el dueño los configuró y activó. Numeración y líneas de venta anteriores permanecieron intactas.
- `netlify/lib/business.mjs`: incorporó estados y validación de los nuevos registros y rechazó su modificación por operaciones genéricas; no modificó las operaciones de Q o Contratos.
- `netlify/lib/accounting-codec.mjs`: declaró claves nuevas de centavos enteros; no reinterpretó claves históricas.
- `netlify/lib/service-mail.mjs`: reconoció exclusivamente claves `client:` para destinatario y PDF privados y reintento explícito; preservó los otros tipos de mensaje.
- `netlify/lib/platform.mjs`: excluyó correos privados de clientes del listado comercial de plataforma.
- `public/ui-texts.js` y `public/ui-text-catalog.mjs`: añadieron catálogo editorial, sin reemplazar claves anteriores.
- `netlify/lib/assistant-guide.mjs` y `public/assistant.js`: añadieron guía y respuesta rápida locales, sin enviar registros al asistente.
- `public/analytics.js` y `public/operations.js`: solo actualizaron la huella de la importación matemática compartida, sin modificar sus operaciones.
- `public/index.html`: cargó el módulo clásico después de sus dependencias; las huellas de recursos cambiaron con el script existente, sin compilación.
- `docs/avance-mejoras.md` y `docs/fase-3-facturacion-cobranza.md`: actualizaron el estado de esta fase conservando el seguimiento anterior.

Archivos nuevos: `netlify/lib/client-rules.mjs`, `netlify/lib/client-communications.mjs`, `netlify/lib/client-pdf.mjs`, `public/client-communications.js`, `tests/client-communications.test.mjs` y este documento.

## Riesgos y reversión

Los correos y mensajes aprobados contienen documentos comerciales privados. Una selección errónea del correo o destinatario de una cotización sin cliente es responsabilidad de la revisión explícita previa; comprobar el PDF antes de confirmar. No hay garantía exactamente una vez frente a una aceptación SMTP seguida de fallo de red: se conserva el estado ambiguo sin reenvío ciego. No se ofrece validación fiscal ni formato oficial. Los estados dependen de la integridad de referencias de facturas y abonos históricos; no se reparan silenciosamente.

Desactivar cada módulo conserva consulta, configuraciones, documentos, historial y cola aprobada. La cola ya aprobada mantiene su autorización de entrega; desactivar evita nuevas solicitudes, no cancela silenciosamente comunicaciones aprobadas. Para detener entregas del servicio debe usarse la configuración SMTP existente y revisar las solicitudes antes de reanudar. No se borra ningún dato ni migración. Las condiciones ya copiadas a facturas se conservan y los cobros realizados se corrigen con el procedimiento contable autorizado, nunca editando documentos o asientos históricos. Revertir el frontend no debe eliminar tablas, claves ni documentos.

## Verificación y matriz manual para la plataforma

Se escribieron 38 pruebas en `tests/client-communications.test.mjs`: cálculo de descuento y centavos, corte de estado, abonos/notas/asignaciones, candidatos antes/después, deduplicación, activación, permisos, soporte, límite de empresa, promesas, envío e instantánea, reintento definitivo/ambiguo/ajeno, límites, términos, cobro parcial/final, Q/Contratos, catálogo por plan y respaldo relacional. Algunas verificaciones de rutas/SMTP son contratos estáticos, no sustituyen integración real. Pasaron las comprobaciones de sintaxis `node --check` en 19 archivos y `git diff --check`; se actualizaron las huellas de recursos. No se ejecutaron pruebas, servidores ni compilaciones; funcionamiento, concurrencia, correo real y apariencia son **no verificados**.

La plataforma debe comprobar:

1. Cuatro planes guardados: Facturación bloquea los módulos nuevos; Básico, Estándar y Pro respetan sus bloqueos editados reales. No modificar planes ni suscripciones de empresas existentes al abrir el módulo. Dueño y colaboradores contador/supervisor con ninguno/lectura/escritura; cajero/vendedor conservan restricciones de rol. Probar URL y API directa.
2. Soporte temporal, soporte expirado y empresas limitadas: consulta autorizada, descargas auditadas y rechazo de toda mutación. Probar empresa ajena, sucursal ajena, cambio de sucursal y consolidado (se requiere seleccionar una sucursal para estos informes).
3. Factura, cotización clásica sin cliente, cotización/proforma de Documentos de venta y estado de cuenta: comprobar destinatario, importes, PDF, CSV, plantillas con caracteres especiales y `wa.me`. Verificar SMTP ausente, aceptación, rechazo definitivo y timeout ambiguo. Dos solicitudes HTTP iguales deben producir una operación/cola; reintento con UUID ajeno o revisión vieja debe rechazarse sin correo adicional.
4. Recordatorios -3/0/+7, recuperación de fechas pasadas, rechazo y nueva generación; ningún envío al consultar/generar. Pagar antes de aprobar debe impedir enviar recordatorio ya liquidado. Verificar bitácora y versión recuperable.
5. Promesas y gestiones por cliente, cortes históricos, abonos, notas y asignaciones por factura. Límite adicional en advertencia/bloqueo, cero, deuda concurrente, API directa y límite histórico todavía vinculante.
6. Condiciones 2/10 n/30: factura histórica sin efecto, nueva factura con copia estable, descuento dentro/fuera de plazo, medio centavo, pago parcial y cobro final, dos pestañas y reversión autorizada. Confirmar cuenta financiera, IVA intacto y asiento balanceado; verifica con tu contador.
7. Vincular Q/Contratos, fuentes sin permiso, pausa/suspensión/cancelación y períodos facturados; vista previa y doble confirmación deben conservar una sola emisión, numeración y anticipos originales. Ninguna tarea debe crear facturas ni cargos por este vínculo.
8. JSON, ZIP y PDF completo: comprobar condiciones, plantillas, destinatarios, instantáneas, límites y eventos tras guardar/restaurar; RLS y rol real de Functions para las tablas existentes y cola. La restauración no debe reencolar documentos ni aceptar modificación de fichas gestionadas.
9. Teléfono, tableta, laptop y PC, temas claro/oscuro, teclado, foco del modal de revisión, tablas desplazables, nombres largos y `.bnav` sin cubrir contenido. Revisar catálogos editados por `uiT` y guía sin acceso a datos comerciales.

Estas comprobaciones posteriores a la entrega son verificaciones no realizadas, no funcionalidades anunciadas como probadas. El estado de entregables escritos de la Fase 3 está en `avance-mejoras.md`.
