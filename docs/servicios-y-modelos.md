# Servicios y modelos de negocio: primera entrega de la ampliación

> Actualización 2026-11-04: este documento describe la entrega inicial. La implementación posterior de Q, plantillas especializadas, reposición y devengo opcionales está en [Cierre de Fase 1](fase-1-cierre-mejoras.md). Su verificación funcional no se ha ejecutado; el estado de la solicitud completa está en [avance-mejoras.md](avance-mejoras.md).


Se implementó la separación inicial de presentación para negocios de servicios y la ampliación del catálogo de perfiles. Esta entrega cubre parte de la Fase 1. No representa la implementación completa de las nueve fases solicitadas.

## Comportamiento

Los perfiles de servicios muestran «Servicios y tarifas» en navegación, catálogo, Más módulos y personalización. Una etiqueta de producto personalizada conserva prioridad y recibe el sufijo «y tarifas». Cuando el catálogo está vacío o contiene solo servicios, la vista presenta código, nombre, unidad de cobro, precio e IVA configurado, sin costo inventariable, valoración, existencias ni acciones de ajuste. Ofrece Crear servicio y Crear producto con inventario. Reutiliza los contenedores y tablas actuales, sus estados de permisos y el espacio para la barra inferior; no modifica style.css ni agrega CSS.

Kardex, Compras y Traslados se ocultan del menú automático y de los accesos del Panel en esos perfiles mientras no haya artículos inventariables. Un artículo con stock cero sigue habilitando su presentación. Los registros históricos sin kind también se consideran inventariables, igual que en el emisor actual. Los servicios no se reclasifican por su nombre o unidad. Las sugerencias futuras del arranque de lavandería se crean como servicios; los artículos ya guardados conservan su tipo.

Personalizar conserva las opciones Automático, Visible y Oculto. Los permisos y bloqueos del plan se evalúan antes de la personalización; Oculto explícito tiene prioridad sobre Visible y sobre la detección de stock. Ocultar no elimina rutas ni información. Más módulos sigue permitiendo abrir las herramientas autorizadas cuando el plan incluye esa pantalla. En Facturación se conserva la restricción previa de Más módulos; Personalizar permite configurar rutas autorizadas.

Se añadieron seis perfiles como datos: software/tecnología/agencias, suscripciones/servicios recurrentes, comercio electrónico, freelance/consultoría individual, inmobiliaria/intermediación y seguros/corretaje. Conservan flujos, preguntas rápidas locales, etiquetas y ejemplos sin precios ni existencias. Reutilizan las 16 capacidades existentes, sin declarar operaciones que todavía no existen. Acontec puede usar Software, tecnología y agencias mediante la corrección administrativa de perfil ya existente; no se cambió automáticamente su empresa ni la de clientes.

La preparación de ventas omite servicios antes de procesar lotes, series, consignaciones o producción, incluso ante referencias inconsistentes. El emisor existente continúa recalculando precio, IVA y costo del servidor; un servicio no origina movimiento de su propio inventario ni costo de mercadería. Las ventas de stock conservan su flujo. No se añadieron llamadas externas, sondeos, dependencias ni tareas programadas.

## Persistencia y compatibilidad

No se añadieron campos ni colecciones persistentes. Se reutilizan tipo de negocio, personalización y productos existentes con sus operaciones protegidas. Por ello no se necesita migración, cambio del esquema o del codec ni nuevas proyecciones, permisos o rutas API. Los perfiles y las preferencias continúan incluidos en las versiones y respaldos existentes. La vista se puede imprimir con las herramientas actuales; no se añadió un nuevo generador PDF.

No se modificaron migraciones, numeraciones, asientos ni registros guardados. Las preferencias siguen pasando por el endpoint existente de perfil y su control de revisión y auditoría; crear servicios utiliza businessProduct dentro de runOperation/updateCompany. El tipo de negocio sigue fijo para el dueño, con corrección administrativa según las reglas actuales.

## Pendiente de implementación

De la Fase 1 faltan duración estándar, reglas explícitas de exención, comisión por servicio/empleado en el catálogo, paquetes, consumibles, capacidad Q completa, sector económico y plantillas contables con vista previa. Contratos no equivale a Q y no se presenta como sustituto de sus métricas, prorrateos ni reconocimiento de ingresos diferidos. La unidad e IVA del servicio mantienen los campos que ya existían.

Las Fases 2–9 siguen pendientes: tesorería/conciliación y proyecciones; comunicación y cobranza; arquitectura fiscal y configuración por país; inventario avanzado; control contable y análisis; personal; salud del sistema; ampliación de Auditoría. No se crearon pantallas vacías, permisos ficticios ni rutas que aparenten implementar esas funciones. No se agregó un informe de auditoría ni se afirma detección de irregularidades.

## Verificación y límites

Se revisaron estáticamente los cambios y su sintaxis. No se ejecutó npm test ni pruebas individuales, servidores, compilaciones, migraciones, pagos o envíos. Las instrucciones del proyecto reservan pruebas y validación funcional a la plataforma. Las pruebas preparadas no se consideran aprobadas. La revisión visual en claro/oscuro y con dispositivos reales sigue no verificada.

Pruebas preparadas: matriz de todos los perfiles de servicios por los cuatro planes, visibilidad automática/forzada/oculta, permisos de colaborador, stock cero e histórico sin kind; perfiles nuevos con capacidades válidas y ejemplos sin saldos; alta de servicio con stock/costo inyectados; omisión de trazabilidad inconsistente sin modificar documentos; ejecución del emisor real con infraestructura sustituida para comparar inventario y asientos de servicio frente a mercadería. No reemplazan las pruebas de integración de API y Database.

Después del despliegue:

- Ejecutar npm test en la plataforma y revisar fallos previos y nuevos por separado.
- Crear una empresa vacía de servicios, omitir/agregar ejemplos y verificar que no aparezca stock ni valoración. Repetir con un servicio nuevo y con un artículo inventariable de stock cero.
- Verificar cada plan con dueño y colaboradores sin permiso, lectura y escritura; probar Visible/Oculto, Más módulos, URL y API directas. Comprobar soporte y empresas limitadas sin escritura.
- Facturar servicio con IVA configurado, servicio de tasa cero y venta mixta. Confirmar costo cero y ausencia de movimiento del servicio, con stock/asiento de mercadería intactos. «Tasa cero» no certifica una exención: verifica con tu contador.
- Comparar una empresa histórica antes/después, incluidos documentos, numeración, artículos sin kind, saldos, series y lotes de productos con stock.
- Guardar personalización desde dos pestañas y comprobar conflicto de revisión; exportar/restaurar JSON y ZIP y revisar perfil, etiquetas y ejemplos. No cambiar el tipo histórico al restaurar.
- Revisar catálogo, menú lateral, Panel, barra inferior y Personalizar en teléfono, tableta, laptop y PC, en claro y oscuro. Verificar foco, permisos, escape de nombres y que .bnav no cubra la última fila.

Riesgo principal: la navegación automática cambia en perfiles de servicios, pero las preferencias explícitas y el stock histórico conservan prioridad. La interfaz solo conoce el catálogo autorizado por el servidor; no infiere la existencia de registros fuera de permisos. No se afirma ahorro de créditos medido; no se añadieron servicios externos ni procesamiento periódico.
