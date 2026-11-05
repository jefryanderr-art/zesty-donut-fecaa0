# Operación de servicios

Esta ampliación continuó después de comercio y reutilizó las fichas, facturas, inventario, anticipos, comisiones, estados de cuenta y permisos existentes. No cambió identificadores de perfiles ni convirtió datos históricos. Abarca profesionales, software, freelance, inmobiliaria, seguros, servicios recurrentes, belleza, salud, educación, gimnasio, taller, lavandería y transporte. Las recomendaciones comunes de Agenda, Proyectos, Contratos, Comisiones y Documentos de venta siempre se subordinan al plan y permisos.

## Común

«Atención y seguimiento» amplía cada ficha con preferencias, próxima fecha, vencimiento, anticipación del aviso y habilitación de encuesta opcional. Los avisos se consultan al abrir el módulo; registrar una encuesta conserva valoración y comentario en el historial. Clientes añade las fichas operativas autorizadas al historial existente, sin reemplazar el estado de cuenta imprimible.

Un bono o tratamiento se configura en un proyecto con cliente y líneas de servicios. «Registrar anticipo» conserva el pasivo y el movimiento de caja/banco existentes. Cada «Facturar etapa» utiliza una clave única, cantidades prestadas y pago a crédito para aplicar el anticipo. El servidor conserva servicios y precios, comprueba cantidades ya consumidas y prepago suficiente. Configurar el bono no factura ni consume inventario. No se admiten cargos porcentuales adicionales en bonos. Un bono puede tener anticipos parciales, pero cada prestación exige cobertura completa. Las notas de crédito no reabren automáticamente sesiones; un remanente del anticipo se devuelve por la operación existente.

Los contratos activos permiten una renovación explícita a otro contrato vinculado con las mismas condiciones, nuevas fechas y sin copiar facturas, anticipos, asistencia ni calendarios anteriores. No se cobra ni se factura al renovar. El contrato original conserva sus períodos y deuda. Solo se admite una renovación de cada contrato; la siguiente parte del contrato renovado.

«Plan de pago» distribuye el crédito original de una factura vinculada en cuotas con fechas crecientes. La API admite hasta 60 cuotas y el formulario hasta seis. Deben sumar exactamente el crédito original; los anticipos aplicados, abonos y notas de crédito se consultan mediante el cálculo compartido, por antigüedad. El calendario no genera cobros ni nuevos asientos, intereses o mora. Se admiten planes para varias facturas de una misma ficha, sin duplicar un calendario para la misma factura.

La venta de servicio, hora, período o etapa conserva el emisor y los controles fiscales, de precio, descuento y caja. Asignar empleado al facturar desde una ficha conserva las instantáneas de comisión del catálogo. El devengo y la liquidación usan el circuito anterior de comisiones y sus bloqueos contra duplicación en nómina. Una ficha no paga comisiones por guardar un nombre de profesional.

## Profesionales, software, freelance, inmobiliaria y seguros

La ficha añade entregables, propiedad/póliza/licencia, condiciones de intermediación, prospecto y fecha de seguimiento. Se pueden crear varias fichas por cliente para su cartera. El honorario de intermediación es una línea de servicio confirmada, no un porcentaje aplicado automáticamente a la propiedad o póliza.

«Registrar tiempo» vincula inicio, fin, descripción y empleado opcional al proyecto y cliente. Impide solapamientos del mismo empleado entre operadores; el tiempo sin empleado se controla por operador. Al facturar una etapa se pueden seleccionar registros pendientes y preparar una única línea de servicio con las horas exactas. Cada registro seleccionado queda vinculado a su factura y no se factura otra vez. Para expresar horas con hasta tres decimales se utilizan intervalos de tres minutos; no se redondean fracciones incompatibles silenciosamente. La facturación manual de etapas continúa disponible sin seleccionar tiempo.

«Pasar a proyecto» traslada una cotización pendiente, sus líneas y anticipo una sola vez. La cotización convertida ya no emite factura desde su ficha. «Entregables y avance» registra porcentaje y constancia en el historial. Pólizas y licencias conservan vencimientos y avisos internos; no se integran con aseguradoras ni proveedores de licencias.

## Belleza, barbería y spa

Agenda conserva sillón como recurso y profesional en la ficha. Se comprueban solapamientos del profesional aunque cambie de recurso. La lista de espera es una marca consultable: no asigna ni promueve citas automáticamente. Se conservan preferencias y se sugiere la próxima fecha a partir del intervalo confirmado, cuando todavía no hay una fecha explícita.

Productos vendidos se agregan como líneas inventariables; consumibles y comisiones reutilizan las características explícitas del servicio. La propina utiliza el cargo voluntario y servicio de catálogo existentes, con confirmación del precio y tratamiento contable. No hay reparto o liquidación automática nueva.

## Salud y veterinaria

Agenda conserva doctor y consultorio. La ficha solo admite datos administrativos de paciente o mascota, dueño, convenio y recordatorio de control/vacuna; se exige confirmar que no se introduce información clínica sensible. No se implementó una historia clínica.

Los tratamientos por sesiones utilizan bonos y anticipos. Los planes de pago se vinculan a facturas a crédito. Los medicamentos e insumos vendidos como líneas inventariables utilizan FEFO, lotes y vencimientos existentes. Los consumibles de catálogo conservan sus límites previos: no se habilitó su consumo automático por lote o serie. Un convenio es una referencia administrativa; no presenta reclamaciones ni cobra a una aseguradora automáticamente.

## Educación

La ficha conserva alumno, grupo, horario y responsable. La selección de un cliente como responsable de pago dirige las siguientes facturas al responsable; su estado de cuenta reúne las facturas de los alumnos asociados. Los documentos previos no se reasignan. Matrícula, mensualidad, material y evento son conceptos del catálogo; los recibos se imprimen con los formatos existentes.

Las condiciones de beca y hermanos requieren al dueño y motivo. El descuento monetario efectivo conserva la autorización vigente al facturar: no se aplican rebajas ocultas. Asistencia conserva fecha y alumno y rechaza duplicados diarios. Contratos reutiliza la mora configurable anterior, con su servicio y generación confirmada. Grupos y horarios son datos administrativos; no se generó un calendario académico automático.

## Gimnasio y recreación

Contratos añade socio, vencimiento, pausa y límite de visitas. Agenda/Reservas permite configurar cupo y registrar reserva, cancelación y asistencia por cliente. El servidor comprueba cupo, reserva previa cuando corresponde, duplicación diaria, estado activo, pausa, vencimiento y límite de visitas. Un pase diario utiliza límite de una visita y la fecha de vencimiento elegida; el pase por visitas utiliza el límite confirmado. La pausa no prorroga fechas automáticamente.

Las fichas muestran cobros vencidos con permisos de Ventas y Contabilidad/Finanzas. La venta mixta de servicios y productos continúa en la misma caja. La asistencia no cobra ni factura, y una deuda no se convierte en bloqueo automático de acceso.

## Taller

La orden amplía recepción con placa/serie, modelo, kilometraje, checklist, aprobación por referencia y fecha, mecánico, garantía y próximo mantenimiento. Una ficha ampliada exige constancia de aprobación del presupuesto antes de facturar. Esta constancia se registra por el operador; no es firma electrónica del cliente. La ficha reúne órdenes autorizadas con la misma placa/serie exacta.

Puede adjuntarse **hasta cinco fotos privadas por orden, una por carga**, JPG, PNG o WebP de hasta 1 MB con autorización explícita. Reutiliza Blobs y los límites de referencias privadas: 100 archivos o 50 MB por empresa, incluidas versiones. Descarga valida sesión, permiso, empresa y sucursal, y se audita. La ficha ofrece una lista de descarga de las fotos. Repuestos y comisiones conservan las operaciones de inventario y catálogo existentes; no se descuenta stock al escribir materiales previstos ni se paga al mecánico por asignarlo.

## Autolavado y lavandería

La ficha conserva etiqueta/número, peso o prendas, domicilio y entrega prometida. «Avanzar lavado» valida Recibido → Lavando → Listo → Entregado. Entregar exige factura. La constancia de aviso al cliente se registra manualmente; no se afirma envío externo. El cobro utiliza cantidad y unidad de la línea del catálogo. Los paquetes prepagados reutilizan bonos de Proyectos; el domicilio es información operativa, sin asignación automática de repartidor ni rutas.

## Transporte y logística

Proyectos/Contratos conserva origen, destino, unidad, conductor, mantenimiento y vencimientos documentales. Cada viaje utiliza un proyecto y la facturación por período utiliza contratos. Combustible, peajes y viáticos se registran con «Registrar costo», vinculados al viaje o contrato. El reporte muestra venta neta, costos vigentes y margen por viaje y unidad; resta notas de crédito y excluye costos anulados. Es acumulado de las fichas autorizadas del módulo, sin gastos indirectos ni conversión de monedas. Los avisos de mantenimiento y documentos son consultables, sin ejecución ni renovación automáticas.

## Persistencia y verificación

Se reutilizaron businessRecords y las tablas relacionales existentes en Netlify Database. Las cuotas nuevas usan amountCents, ya declarado como centavos nativos en el codec. No hubo cambios de esquema ni migraciones. Las mutaciones usan runOperation/updateCompany, revisión, bloqueo transaccional, identificador idempotente, permisos y plan, sucursal del servidor, versiones y auditoría. Fotos privadas mantienen el respaldo existente. La interfaz conserva estilos, impresión y escape del sistema.

Se revisaron código, diferencias y sintaxis estáticamente. Se prepararon casos para la plataforma, **sin ejecutar pruebas, servidores ni compilaciones locales**. Se actualizaron la guía del asistente, respuestas rápidas y huellas de recursos.

Después del despliegue están pendientes las comprobaciones funcionales, visuales y de concurrencia: permisos/planes/sucursales/consolidado/soporte, conflictos entre pestañas, conversión repetida, anticipos y sesiones parciales, facturas/abonos/notas de crédito, horas y comisiones de empleados, solapamientos de profesionales, cupos concurrentes, pausas/visitas, becas y responsable de pago, estados y entrega de lavado, aprobación del taller, carga/descarga/restauración de foto, costos anulados y márgenes, renovación, impresión, móvil, oscuro y teclado. Las limitaciones descritas arriba siguen vigentes; esta entrega no constituye validación funcional ni automatización de todas las operaciones solicitadas.
