# Seguimiento de las mejoras solicitadas

Fecha: 2026-11-04. Estado: implementación de la Fase 1 escrita y revisada estáticamente; pruebas funcionales, integración y apariencia **no verificadas**. Las casillas indican código, permisos, pruebas escritas, textos por uiT, descargas aplicables y documentación, no aprobación de pruebas ejecutadas. Evidencia detallada en [fase-1-cierre-mejoras.md](fase-1-cierre-mejoras.md).

## Decisión recibida y excepción exclusiva de PEPS

El propietario respondió **«No, mantener el motor sin cambios»** a la propuesta de estrategia PEPS optativa. F5.1 queda **impedido por esa decisión**, sin código operativo, capas, migraciones ni efecto sobre empresas. Implementarlo exigiría autorizar otra tarea que integre selección/consumo de capas en ventas futuras; no se solicitó de nuevo ese permiso ni se reinterpretó la respuesta. El promedio ponderado y las funciones emisoras existentes se conservaron.

El propietario confirmó que **solo PEPS queda exceptuado de la secuencia**. F5.1 permanece sin marcar y sin efecto, pero no impide continuar con fases posteriores. Ningún otro ítem recibe esta excepción: si existe un impedimento real, se aplica B.4 con motivo exacto. No se vuelve a solicitar permiso para modificar el motor. La Fase 2 tiene conciliación en moneda base escrita y **desactivada de forma fija** en servidor e interfaz; todavía no está cerrada. Fases 3–9 no se iniciaron.

## A. Base existente que se debe preservar

- [x] A.1 Preservar Servicios y tarifas y ocultación condicional de Kardex, Compras y Traslados.
- [x] A.2 Preservar los seis perfiles incorporados y las exclusiones de servicios en lotes, series, consignaciones y producción.
- [x] A.3 Preservar duración, unidad de cobro, IVA/exención y comisiones de referencia del catálogo.
- [x] A.4 Preservar paquetes sin stock y consumibles opcionales con asiento y sucursal.
- [x] A.5 Preservar sector económico y sugerencias mínimas aplicables sin movimientos.

## B. Ejecución y cierre

- [x] B.1 Mantener esta lista completa y marcar solo entregables íntegros con sus evidencias.
- [ ] B.2 Cerrar los ítems en orden sin iniciar una fase posterior antes del cierre de la anterior.
- [ ] B.3 Resolver conservadoramente dudas ordinarias y documentarlas; consultar solo conflictos o alteraciones históricas.
- [ ] B.4 Ante impedimento real, dejar la función sin efecto y registrar motivo, faltantes y continuación.
- [ ] B.5 Contrastar todas las casillas con el código antes de entregar y comunicar su estado real.

## C. Contexto y lectura

- [ ] C.1 Conservar frontend estático, API ESM, Netlify Database/Blobs y Drizzle.
- [ ] C.2 Conservar Identity, Google, permisos, sucursales, versiones y correo existente.
- [ ] C.3 Revisar AGENTS.md, README.md y todos los documentos requeridos, incluyendo el historial, antes de implementar.
- [ ] C.4 Mantener Nicaragua, America/Managua, NIO y USD como contexto sin inferir reglas fiscales.

## D. Controles transversales de todas las fases

- [ ] D.1 Preservar significado histórico, asientos, facturas, numeraciones y migraciones; conservar el motor sin cambios conforme a la decisión recibida.
- [ ] D.2 Mantener toda ampliación sin efecto inicial en empresas existentes y activación explícita cuando corresponda.
- [ ] D.3 Usar centavos enteros, cálculos compartidos y recálculo/validación en servidor.
- [ ] D.4 Tramitar mutaciones por runOperation/updateCompany con sesión, membresía, plan y permiso.
- [ ] D.5 Validar sucursal del servidor, bloqueo, revisión, idempotencia, bitácora y transacción única.
- [ ] D.6 Corregir documentos contabilizados mediante nota de crédito o reversa, nunca editarlos o borrarlos.
- [ ] D.7 Añadir permisos propios de tres niveles y bloqueo por plan; soporte y empresas limitadas en lectura.
- [ ] D.8 Mantener credenciales exclusivamente en configuración de Netlify y excluir secretos del navegador y documentos.
- [ ] D.9 Usar reglas editables y «verifica con tu contador» sin afirmar cumplimiento ni inventar formatos oficiales.
- [ ] D.10 Justificar por escrito cualquier dependencia necesaria; conservar ausencia de compilación frontend.
- [ ] D.11 Reutilizar tareas existentes sin nuevos sondeos ni tareas programadas.
- [ ] D.12 Conservar style.css, colores y estilos existentes; usar variables del tema si se agrega hoja aparte.
- [ ] D.13 Incorporar textos por uiT/ui-texts y diseño para teléfono, tableta, laptop y PC sin interferir con bnav.
- [ ] D.14 Ofrecer PDF y Excel/CSV para cada listado/informe nuevo con empresa, período, fecha, autor y versión.
- [ ] D.15 Autorizar y auditar descargas por empresa, permiso y sucursal.
- [ ] D.16 Incluir datos nuevos en respaldo JSON/ZIP y PDF completo.
- [ ] D.17 Escribir pruebas por regla sin ejecutar pruebas, servidores ni compilaciones locales.
- [ ] D.18 Ejecutar node --check por archivo JavaScript modificado, versionar recursos cuando corresponda y ejecutar git diff --check.
- [ ] D.19 Trabajar en el espacio administrado sin commits manuales, mezcla a principal ni despliegue.
- [ ] D.20 Revisar cada diff y documentar rutas, permisos, planes, sucursales, RLS e índices por empresa.
- [ ] D.21 Documentar compatibilidad de cada archivo existente modificado y alcance/límites/migración/verificaciones por fase.
- [ ] D.22 Mantener PEPS apagado por defecto, hacia adelante, con confirmación, motivo y auditoría.
- [ ] D.23 Mantener eliminaciones intercompañía apagadas por defecto, con confirmación, motivo y auditoría.
- [ ] D.24 Mantener revalorización cambiaria apagada por defecto, con confirmación, motivo y auditoría.
- [ ] D.25 Mantener bloqueo de períodos apagado por defecto para la ampliación, con confirmación, motivo y auditoría.
- [ ] D.26 Mantener numeración fiscal apagada por defecto para la ampliación, con confirmación, motivo y auditoría.

## Fase 1: cierre obligatorio antes de Fase 2

- [x] F1.1a Capacidad Q independiente de Contratos, recomendada para software/suscripciones y opcional en otros perfiles.
- [x] F1.1b Planes del cliente final y periodicidad, con factura por período confirmada por usuario.
- [x] F1.1c Prorrateo en altas y bajas, pausa y cancelación.
- [x] F1.1d Historial inmutable de renovaciones y control contra duplicados.
- [x] F1.1e Anticipos como pasivo y reconocimiento periódico confirmado de ingresos diferidos.
- [x] F1.1f MRR, ARR, churn y antigüedad de cartera recurrente.
- [x] F1.1g Permisos, planes, respaldo, PDF y descargas de Q sin cargos automáticos a tarjetas.
- [x] F1.2 Plantillas especializadas por perfil/sector con vista previa y confirmación, solo sin movimientos y conservando cuentas existentes.
- [x] F1.3a Reposición optativa y confirmada de consumibles en nota de crédito de servicio.
- [x] F1.3b Asignación explícita o bloqueo comprensible para consumibles con lotes, series o producción.
- [x] F1.3c Devengo optativo y confirmado de comisiones con asiento vinculado y sin duplicar nómina.
- [x] F1.4a Pruebas escritas de prorrateo e ingresos diferidos.
- [x] F1.4b Pruebas escritas de MRR, ARR y churn.
- [x] F1.4c Pruebas escritas de reposición por nota de crédito.
- [x] F1.4d Pruebas escritas de visibilidad por plan, perfil y personalización.
- [x] F1.Cierre Revisión completa, documentación de fase, compatibilidad por archivo y comprobaciones de vista previa.

## Fase 2: tesorería y bancos

Estado detallado, límites y comprobaciones: [fase-2-tesoreria-bancos.md](fase-2-tesoreria-bancos.md). La conciliación en moneda base está escrita y apagada; el soporte de otra moneda y el resto de esta fase impiden su cierre. No se presentan como terminados ni reciben la excepción de PEPS.

- [ ] F2.1a Importación CSV/XLSX de extractos con vista previa y mapeos guardados por banco; OFX solo si es viable sin dependencia pesada.
- [ ] F2.1b Sugerencias por monto, fecha y referencia y confirmación manual de emparejamientos.
- [ ] F2.1c Partidas conciliadas, pendientes y en tránsito y asiento confirmado de movimientos sin contrapartida.
- [ ] F2.1d Reporte libro/banco/diferencia y cierre de conciliación que impide editar lo conciliado.
- [ ] F2.2 Entidades en moneda base escritas (banco, máscara, cuenta y ciclos); soporte de otra moneda todavía incompleto. No se infiere moneda de asientos históricos. Continuación: saldos y conversiones explícitos hacia adelante; ver documento de fase.
- [ ] F2.3a Proyección desde cobrar, pagar, recurrentes, nómina, impuestos y préstamos.
- [ ] F2.3b Escenarios optimista/base/pesimista, liquidez y fecha de faltante.
- [ ] F2.3c Método indirecto reconciliado con el estado de flujo.
- [ ] F2.4 Lotes de pago a proveedores con lista, aprobación por monto, constancia y asiento único.
- [ ] F2.5 Anticipos de clientes/proveedores como pasivo/activo, aplicación y devolución.
- [ ] F2.6 Revaluación cambiaria mensual y reversa confirmadas y protegidas por interruptor.
- [ ] F2.7 Tasas por archivo/pegado, fuente y fecha y adaptador oficial optativo apagado, tolerante a falta de red.
- [ ] F2.Cierre Revisión, permisos, pruebas, uiT, descargas, respaldo, documentación y compatibilidad por archivo.

## Fase 3: facturación, cobranza y comunicación

- [ ] F3.1a Correo con PDF de factura, cotización, proforma y estado de cuenta mediante cola e idempotencia existentes.
- [ ] F3.1b Plantillas por empresa, registro enviado/error/reintento y alternativa wa.me sin API.
- [ ] F3.2a Reglas de cobranza antes/después del vencimiento y recordatorios sujetos a aprobación.
- [ ] F3.2b Estado de cuenta, promesas de pago e historial de gestión por cliente.
- [ ] F3.2c Límites de crédito con advertencia o bloqueo configurable.
- [ ] F3.3 Términos y descuentos por pronto pago con asiento al cobrar.
- [ ] F3.4 Emisiones recurrentes ligadas a Q y Contratos, próximas emisiones y confirmación.
- [ ] F3.Cierre Revisión, permisos, pruebas, uiT, descargas, respaldo, documentación y compatibilidad por archivo.

## Fase 4: arquitectura fiscal prudente

- [ ] F4.1a Proveedor fiscal: preparar, firmar/enviar, consultar y anular, con manual DGI predeterminado.
- [ ] F4.1b Número/fecha manuales, marca DOCUMENTO NO FISCAL cuando falten y estados con historial.
- [ ] F4.2 Validaciones configurables de identificación por monto, campos, formato y agotamiento de rangos.
- [ ] F4.3 Rangos por serie/sucursal, alertas, bloqueo fuera de rango y auditoría de saltos con interruptor.
- [ ] F4.4 Retenciones practicadas/sufridas, constancias, acumulados por tercero y cruce con anticipo/declaración.
- [ ] F4.5 Exportaciones configurables de apoyo al contador, sin afirmar homologación oficial.
- [ ] F4.6 Plantillas editables de país para IVA, etiquetas, renta, aportes y calendarios sin cambiar Nicaragua actual.
- [ ] F4.7 Checklist mensual/anual y bloqueo de período confirmado con interruptor.
- [ ] F4.Cierre Revisión, permisos, pruebas, uiT, descargas, respaldo, documentación y compatibilidad por archivo.

## Fase 5: inventario avanzado optativo

- [ ] F5.1 **Impedido por decisión expresa del propietario:** conservar promedio ponderado; PEPS exige modificar el recorrido de costeo que no se autorizó. Sin implementación ni efecto. Continuación: nueva autorización de alcance antes de desarrollar capas para operaciones futuras.
- [ ] F5.2 Bodegas por sucursal, traslados, existencias y alertas mínimo/máximo/reposición.
- [ ] F5.3 Kits de productos separados de recetas, componentes, descuento de stock y costo.
- [ ] F5.4 Conteo cíclico por zona/categoría con ajuste confirmado.
- [ ] F5.5 Consignación de proveedores y valor neto realizable como reporte sin asiento automático.
- [ ] F5.6 Múltiples gastos de desembarque por compra y costo puesto en bodega.
- [ ] F5.Cierre Revisión, permisos, pruebas, uiT, descargas, respaldo, documentación y compatibilidad por archivo.

## Fase 6: contabilidad, control y análisis

- [ ] F6.1 Presupuesto/real por cuenta, centro, proyecto y sucursal con alertas y versiones.
- [ ] F6.2 Reclasificaciones, recurrentes y ajustes con preparó/revisó/aprobó y bloqueo de período.
- [ ] F6.3 Eliminaciones intercompañía confirmadas para hasta veinte empresas, solo reporte y con interruptor.
- [ ] F6.4 Componentes, mejoras, revaluación optativa y depreciación por producción de activos; impuesto diferido informativo y movimiento anual.
- [ ] F6.5a DSO/DPO/DIO y ciclo de conversión de efectivo por perfil/sector.
- [ ] F6.5b Márgenes, equilibrio, liquidez, endeudamiento y rotación con comparación y explicación.
- [ ] F6.5c EBITDA, flujo operativo libre, ROE y ROA con comparación y explicación.
- [ ] F6.6 Costeo ABC y rentabilidad por cliente, producto, servicio, empleado y sucursal.
- [ ] F6.7 Paneles por dueño, contador, cajero y vendedor con permisos reales.
- [ ] F6.8 Notas editables a estados financieros y paquete de cierre PDF.
- [ ] F6.Cierre Revisión, permisos, pruebas, uiT, descargas, respaldo, documentación y compatibilidad por archivo.

## Fase 7: personal y nómina

- [ ] F7.1 Interfaz de adelantos/préstamos a empleados, cuotas y descuento confirmado en nómina.
- [ ] F7.2 Vacaciones: calendario, aprobación, saldos y pasivo laboral.
- [ ] F7.3 Planillas por sucursal/área y costo total con cargas/provisiones.
- [ ] F7.4 Comisiones por metas con escalas por tramo.
- [ ] F7.5 Constancias de trabajo/ingresos PDF con texto editable.
- [ ] F7.6 Parámetros laborales por país enlazados con F4.6.
- [ ] F7.Cierre Revisión, permisos, pruebas, uiT, descargas, respaldo, documentación y compatibilidad por archivo.

## Fase 8: salud del sistema

- [ ] F8.1 Panel solo de plataforma con errores de correo, pagos sin conciliar, migraciones y tareas fallidas.
- [ ] F8.2 Solo lectura y exclusión de datos de clientes.
- [ ] F8.Cierre Revisión, permisos, pruebas, uiT, descargas si hay listados, documentación y compatibilidad por archivo.

## Fase 9: ampliar Auditoría existente sin duplicarla

- [ ] F9.0 Conservar auditEvents, acontec_audit_events, ruta auditoria e Integridad contable; detectar sin corregir.
- [ ] F9.1 Ejecución bajo demanda por período con permiso propio, dueño/contador por defecto, historial inmutable, metadatos y PDF/CSV.
- [ ] F9.2a Reglas explicables de anulaciones, notas de crédito y devoluciones por usuario/turno.
- [ ] F9.2b Descuentos altos/repetidos y precios distintos del catálogo.
- [ ] F9.2c Saltos de numeración, documentos fuera de horario y feriados.
- [ ] F9.2d Montos redondos repetidos, cercanía a límite de aprobación y duplicados.
- [ ] F9.2e Faltantes recurrentes de caja.
- [ ] F9.2f Mermas/ajustes inusuales, existencias negativas y costos atípicos.
- [ ] F9.2g Gastos/vales sin comprobante y proveedores nuevos de alto monto.
- [ ] F9.2h Asientos manuales a fin de mes, reaperturas, períodos cerrados y falta de documento.
- [ ] F9.2i Partidas antiguas de conciliación solo si Fase 2 está activa.
- [ ] F9.2j Accesos fuera de horario, permisos y separación de funciones entre facturar, anular y cobrar.
- [ ] F9.2k Clientes vencidos con descuentos.
- [ ] F9.2l Empleados que también son proveedores/clientes.
- [ ] F9.2m Empleados duplicados en nómina, salarios fuera de rango y pagos sin expediente.
- [ ] F9.3 Riesgo explicado por área/usuario con lenguaje neutral y gravedad alta/media/baja.
- [ ] F9.4 Seguimiento nuevo/en revisión/justificado/confirmado/descartado, responsable, cierre comentado y evidencia existente sin borrar cerrados.
- [ ] F9.5 Recordatorio mensual interno optativo sin correo automático.
- [ ] F9.6 Umbrales por empresa y sugerencias de perfil/sector con cambios auditados.
- [ ] F9.7 Permisos/sucursales y prohibición de enviar información a terceros o IA sin activación del dueño.
- [ ] F9.8 Datos sintéticos positivos y falsos positivos por regla, separación de funciones e inmutabilidad de datos contables al ejecutar.
- [ ] F9.9 Documentar reglas, umbrales, límites, falsos positivos y naturaleza interna sin valor de auditoría externa ni prueba legal.
- [ ] F9.Cierre Revisión, permisos, pruebas, uiT, descargas, respaldo, documentación y compatibilidad por archivo.

## Entrega y prohibiciones

- [ ] E.1 Relacionar commits creados por la plataforma por fase y todas las migraciones nuevas en orden; indicar cuando no existan.
- [ ] E.2 Separar lo realizado, no realizado y no verificado.
- [ ] E.3 Describir riesgos y reversión por fase conservando tablas/documentos y señalando migraciones inocuas.
- [ ] E.4 Preparar comprobaciones de vista previa para los cuatro planes, colaboradores, soporte y empresas limitadas.
- [ ] E.5 Preparar comprobaciones en teléfono/laptop, claro/oscuro, y completar matriz sin afirmar resultados no ejecutados.
- [ ] P.1 No alterar motor protegido, históricos, asientos ni numeraciones existentes.
- [ ] P.2 No eliminar capacidades/rutas ni rehacer la Fase 1 existente.
- [ ] P.3 No activar cargos automáticos, envíos masivos o llamadas externas por defecto.
- [ ] P.4 No guardar tarjetas ni credenciales en Database.
- [ ] P.5 No presentar impuestos/nómina/intereses como asesoría legal/fiscal.
- [ ] P.6 No crear migraciones destructivas ni reescribir las aplicadas.
- [ ] P.7 No desplegar a producción ni mezclar con principal.
- [ ] P.8 No declarar funcionamiento sin prueba ejecutada.

## Evidencia de esta sesión

Se implementaron las funciones descritas en el documento de cierre de Fase 1. Se escribieron pruebas y se revisaron estáticamente permisos, transacciones, sucursales, exportación y compatibilidad; no se ejecutaron pruebas ni se afirmó validación funcional. `node --check`, el versionado de recursos y `git diff --check` se ejecutaron; el cierre documenta los resultados. No hubo cambios de esquema, migraciones nuevas, commits manuales ni despliegues. La lista fue recorrida: solo se marcaron los entregables de Fase 1 con evidencias escritas; Fase 2 conserva sus casillas sin marcar mientras se completa su alcance; Fases 3–9 no se iniciaron. Los controles transversales de toda la solicitud no se dan por cumplidos por verificar una sola fase.

La revisión adicional corrigió la colisión de Q con la ruta histórica `recurrentes`: Q usa `suscripciones`, sin sustituir Plantillas y devengos. Se escribió una prueba de regresión. Se añadió respaldo PDF completo autorizado y rechazo de períodos invertidos. La Fase 2 conserva `BANKS_READY=false` y `BANKS_UI_READY=false`; no se pueden activar mediante cuerpo de petición, variable de entorno ni restauración. Hay pruebas escritas de la guarda, importes, importación, permisos, máscaras, conciliación y cierre. El tratamiento de otra moneda y F2.3–F2.7 no están implementados, por lo que no se marca esta fase ni se inicia otra. Se comprobó sintaxis en 32 archivos JavaScript y el diff; no se ejecutaron pruebas.
