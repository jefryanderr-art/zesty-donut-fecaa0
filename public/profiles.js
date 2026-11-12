'use strict';
// Catálogo compartido por el navegador y Functions. Sin acceso al DOM ni datos de clientes.
(() => {
 const capabilities={
  declaraciones:{letter:'AU',name:'Declaraciones',group:'Fiscal',flow:'Borradores vinculados a la contabilidad y paquete del período. Verifica con tu contador.'},
  cierre_anual:{letter:'AV',name:'Cierre anual',group:'Fiscal',flow:'Revisa pendientes y asientos, respalda y cierra el ejercicio con apertura contabilizada.'},
  prestamos_personal:{letter:'AO',name:'Adelantos y préstamos a empleados',group:'Personal',flow:'Activación del dueño con motivo; verifica con tu contador.'},
  vacaciones_personal:{letter:'AP',name:'Vacaciones y pasivo laboral',group:'Personal',flow:'Activación del dueño con motivo; verifica con tu contador.'},
  planillas_area:{letter:'AQ',name:'Planillas por sucursal y área',group:'Personal',flow:'Activación del dueño con motivo; verifica con tu contador.'},
  comisiones_meta:{letter:'AR',name:'Comisiones por meta',group:'Personal',flow:'Activación del dueño con motivo; verifica con tu contador.'},
  parametros_laborales:{letter:'AS',name:'Parámetros laborales por país',group:'Personal',flow:'Activación del dueño con motivo; verifica con tu contador.'},

  indicadores_financieros:{letter:'AK',name:'Indicadores financieros',group:'Finanzas',flow:'Informe de apoyo; verifica con tu contador.'},
  costeo_abc:{letter:'AL',name:'Costeo por actividades',group:'Finanzas',flow:'Informe de apoyo; verifica con tu contador.'},
  tableros_rol:{letter:'AM',name:'Cuadros de mando por rol',group:'Finanzas',flow:'Informe de apoyo; verifica con tu contador.'},
  notas_financieras:{letter:'AN',name:'Notas y paquete de cierre',group:'Finanzas',flow:'Informe de apoyo; verifica con tu contador.'},

  constancias_laborales:{letter:'AK',name:'Constancias laborales',group:'Personal',flow:'Configura textos y descarga constancias de trabajo o ingresos; verifica con tu contador.'},
  comunicacion:{letter:'X',name:'Comunicación con clientes',group:'Ventas',flow:'Revisa el documento y confirma cada envío.'},
  cobranza:{letter:'Y',name:'Gestión de cobranza',group:'Ventas',flow:'Revisa vencimientos, promesas y recordatorios antes de aprobar.'},
  terminos_pago:{letter:'Z',name:'Términos de pago',group:'Ventas',flow:'Configura condiciones futuras y confirma descuentos al cobrar; verifica con tu contador.'},
  cumplimiento_fiscal:{letter:'AB',name:'Cumplimiento fiscal',group:'Finanzas',flow:'Configura proveedor manual, validaciones y rangos; verifica con tu contador.'},
  retenciones_fiscales:{letter:'AC',name:'Retenciones y constancias',group:'Finanzas',flow:'Consulta acumulados por tercero y cruza con anticipo y declaración.'},
  cierre_periodo:{letter:'AD',name:'Checklist de cierre',group:'Finanzas',flow:'Completa cada ítem y confirma el cierre mensual o anual.'},
  bodegas:{letter:'AE',name:'Bodegas y ubicaciones',group:'Inventario',flow:'Crea bodegas, distribuye la existencia y traslada entre bodegas de la sucursal.'},
  kits:{letter:'AF',name:'Kits y combos',group:'Inventario',flow:'Define componentes y consulta costo y disponibilidad del kit.'},
  conteo_ciclico:{letter:'AG',name:'Conteo cíclico',group:'Inventario',flow:'Abre un conteo por zona o categoría y vincula el ajuste confirmado.'},
  consignacion_vnr:{letter:'AH',name:'Consignación y valor neto realizable',group:'Inventario',flow:'Registra consignaciones y revisa el reporte de valor neto realizable; verifica con tu contador.'},
  desembarque:{letter:'AI',name:'Gastos de desembarque',group:'Inventario',flow:'Asocia facturas de gasto a una compra y consulta el costo puesto en bodega.'},
  presupuestos:{letter:'AJ',name:'Presupuesto vs real',group:'Finanzas',flow:'Crea presupuestos por cuenta, centro, proyecto o sucursal y revisa desviaciones; verifica con tu contador.'},
  emision_recurrente:{letter:'AA',name:'Próximas facturas',group:'Servicio',flow:'Vincula Q o Contratos y confirma cada emisión desde su módulo.'},
  flujo_proyectado:{letter:'S',name:'Flujo proyectado',group:'Finanzas',flow:'Consulta escenarios y supuestos sin modificar la contabilidad.'},
  pagos_lote:{letter:'T',name:'Pagos por lote',group:'Finanzas',flow:'Prepara, aprueba y confirma un lote de proveedores.'},
  anticipos:{letter:'U',name:'Anticipos',group:'Finanzas',flow:'Registra, aplica o devuelve anticipos por tercero.'},
  revalorizacion:{letter:'V',name:'Revalorización cambiaria',group:'Finanzas',flow:'Revisa y confirma cierre y reversa; verifica con tu contador.'},
  tipos_cambio:{letter:'W',name:'Importación de tasas',group:'Finanzas',flow:'Revisa fuente y fecha antes de importar tasas nuevas.'},
  bancos:{letter:'R',name:'Bancos y conciliación',group:'Finanzas',flow:'Importa, revisa y confirma las partidas antes de cerrar la conciliación.'},
  cuentas_abiertas:{letter:'A',name:'Cuentas abiertas',group:'Servicio',flow:'Acumula consumos y confirma el cobro al cerrar la cuenta.'},
  agenda:{letter:'B',name:'Agenda y citas',group:'Servicio',flow:'Reserva un recurso, registra la atención y factura al finalizar.'},
  proyectos:{letter:'C',name:'Órdenes de trabajo y proyectos',group:'Servicio',flow:'Recibe, presupuesta, registra avances y factura por etapas.'},
  lotes:{letter:'D',name:'Lotes y vencimientos',group:'Inventario',flow:'Registra lotes y selecciona primero los que vencen antes (FEFO).'},
  variantes:{letter:'E',name:'Variantes, series y garantías',group:'Inventario',flow:'Relaciona talla, color, modelo y series con un artículo del catálogo.'},
  produccion:{letter:'F',name:'Recetas y producción',group:'Inventario',flow:'Define ingredientes, rendimiento y merma; confirma producción o preparación al vender.'},
  medidas:{letter:'G',name:'Venta por peso y medida',group:'Inventario',flow:'Registra una medida neta y confirma cantidad y precio por unidad.'},
  cartera:{letter:'H',name:'Cartera, préstamos y empeño',group:'Finanzas',flow:'Configura condiciones y cuentas, desembolsa y confirma cada cobro.'},
  contratos:{letter:'I',name:'Contratos y cobros recurrentes',group:'Servicio',flow:'Configura períodos y genera cada cobro con confirmación.'},
  reservas:{letter:'J',name:'Reservas y ocupación',group:'Servicio',flow:'Consulta disponibilidad, reserva y confirma entrada y salida.'},
  rutas:{letter:'K',name:'Rutas y preventa',group:'Ventas',flow:'Prepara pedidos por vendedor y ruta; confirma entrega y factura.'},
  despacho:{letter:'L',name:'Despacho de pedidos',group:'Ventas',flow:'Recibe, prepara y entrega pedidos con tickets correlativos.'},
  comisiones:{letter:'M',name:'Comisiones por servicio',group:'Personal',flow:'Calcula una comisión sobre una venta confirmada y liquídala una sola vez.'},
  aportes:{letter:'N',name:'Donaciones, cuotas y aportes',group:'Finanzas',flow:'Identifica al socio o donante y el fondo; confirma el recibo y su asiento.'},
  documentos_venta:{letter:'O',name:'Documentos de venta',group:'Ventas',flow:'Prepara cotizaciones, proformas, pedidos y notas de entrega; convierte a factura.'},
  suscripciones:{letter:'Q',name:'Suscripciones y facturación recurrente',group:'Servicio',flow:'Confirma cada período, anticipo y reconocimiento; sin cobros automáticos.'},
  comprobantes:{letter:'P',name:'Comprobantes adaptados',group:'Ventas',flow:'Imprime los registros autorizados en A4, Carta o ticket.'}
 };
 const all=Object.keys(capabilities), common=['panel','facturacion','ventas','clientes','compras','gastos','productos','cobrar','pagar','ajustes','accesibilidad','auditoria'];
 const rows=[
 ['comercio','Comercio general','Comercio',['rutas'],[],'cliente','producto','factura','Venta y facturación actuales.','Mercadería','unidad','Artículo de ejemplo'],
 ['minorista','Tienda minorista, pulpería y supermercado','Comercio',['medidas','documentos_venta','rutas'],[],'cliente','artículo','factura','Selecciona artículos o ingresa la medida y confirma el pago.','Abarrotes','kg','Producto a granel'],
 ['ropa','Ropa, calzado y accesorios','Comercio',['variantes','documentos_venta'],[],'cliente','artículo','factura','Elige talla y color antes de facturar.','Prendas','unidad','Prenda de ejemplo'],
 ['ferreteria','Ferretería, materiales y repuestos','Comercio',['documentos_venta','variantes','rutas'],[],'cliente','artículo','factura','Prepara el pedido y confirma cantidades y medidas.','Materiales','metro','Material de ejemplo'],
 ['farmacia','Farmacia y productos naturales','Comercio',['lotes','variantes','documentos_venta'],[],'cliente','producto','factura','Comprueba lote y vencimiento antes de vender.','Productos naturales','unidad','Producto de ejemplo'],
 ['tecnologia','Electrónica, celulares y tecnología','Comercio',['variantes','proyectos','documentos_venta'],[],'cliente','artículo','orden','Identifica serie y garantía; recibe reparaciones en una orden.','Equipos','unidad','Equipo de ejemplo'],
 ['restaurante','Restaurante, bar y cafetería','Alimentos',['cuentas_abiertas','despacho','produccion','comisiones','documentos_venta'],[],'comensal','platillo','cuenta','Abre la mesa, acumula consumos, prepara y cobra.','Platillos','porción','Platillo de ejemplo'],
 ['comida_rapida','Comida rápida y food truck','Alimentos',['cuentas_abiertas','despacho','produccion','comisiones','documentos_venta'],['medidas'],'cliente','producto','ticket','Selecciona productos, confirma pago y pasa a preparación.','Preparaciones','unidad','Preparación de ejemplo'],
 ['catering','Catering y eventos','Alimentos',['cuentas_abiertas','despacho','produccion','comisiones','documentos_venta','proyectos'],['contratos'],'cliente','servicio','orden','Cotiza el evento, registra anticipos y factura al entregar.','Eventos','servicio','Servicio de evento'],
 ['panaderia','Panadería y repostería','Alimentos',['cuentas_abiertas','despacho','produccion','comisiones','documentos_venta','medidas','lotes','proyectos'],['rutas','variantes'],'cliente','producto','ticket','Planifica hornadas, escala recetas y confirma producción antes de vender o entregar encargos.','Panadería y repostería','unidad','Pan de ejemplo'],
 ['profesionales','Servicios profesionales','Servicios',['agenda','proyectos','contratos','documentos_venta'],[],'cliente','servicio','factura','Agenda, presupuesta y factura por proyecto o período.','Honorarios','hora','Consulta profesional'],
 ['belleza','Belleza, barbería y spa','Servicios',['agenda','comisiones'],['cuentas_abiertas'],'cliente','servicio','cuenta','Agenda al profesional, atiende y cobra el servicio.','Servicios','servicio','Servicio de belleza'],
 ['salud','Clínicas, consultorios, odontología y veterinaria','Servicios',['agenda','cuentas_abiertas'],['lotes'],'paciente','servicio','recibo','Agenda la atención y cobra por tratamiento; evita información clínica sensible en notas.','Atenciones','consulta','Consulta de ejemplo'],
 ['educacion','Academias, guarderías y centros de idiomas','Servicios',['contratos','agenda'],[],'alumno','servicio','recibo','Registra matrícula y mensualidades por alumno.','Mensualidades','mes','Mensualidad de ejemplo'],
 ['gimnasio','Gimnasio, deportes y recreación','Servicios',['contratos','agenda','reservas'],[],'socio','servicio','recibo','Registra membresías y reserva espacios por horario.','Membresías','mes','Membresía de ejemplo'],
 ['taller','Taller mecánico, carpintería y reparaciones','Servicios',['proyectos','variantes','documentos_venta'],['lotes'],'cliente','servicio','orden','Recibe el equipo, diagnostica, presupuesta y confirma la entrega.','Reparaciones','hora','Mano de obra'],
 ['lavanderia','Autolavado y lavandería','Servicios',['cuentas_abiertas','medidas','despacho'],[],'cliente','servicio','orden','Recibe el pedido, pesa si corresponde y cobra al entregar.','Lavado','kg','Servicio de lavado'],
 ['hotel','Hotel, hostal y alquiler vacacional','Alquileres',['reservas','cuentas_abiertas','contratos'],[],'huésped','servicio','cuenta','Reserva, registra entrada, acumula consumos y cierra la cuenta.','Hospedaje','noche','Noche de hospedaje'],
 ['alquiler','Alquiler de propiedades, equipos y vehículos','Alquileres',['contratos','reservas'],[],'inquilino','servicio','recibo','Configura contrato, disponibilidad y depósitos por separado del ingreso.','Alquileres','día','Alquiler de ejemplo'],
 ['prestamista','Préstamos, microfinanzas y casas de empeño','Finanzas',['cartera'],['contratos'],'deudor','servicio','recibo','Revisa condiciones, garantía y cuentas antes de desembolsar.','Servicios financieros','servicio','Servicio de ejemplo'],
 ['construccion','Construcción y contratistas','Producción',['proyectos','documentos_venta'],[],'cliente','servicio','orden','Presupuesta por obra, registra costos y factura avances.','Obras','servicio','Etapa de obra'],
 ['agro','Agropecuario y agroindustria','Producción',['lotes','medidas','produccion'],[],'cliente','producto','factura','Identifica ciclos y lotes; registra insumos y rendimiento.','Producción agropecuaria','kg','Producto agropecuario'],
 ['manufactura','Manufactura y producción artesanal','Producción',['produccion','documentos_venta'],['lotes'],'cliente','producto','orden','Define materiales y rendimiento; produce contra una orden.','Producción','unidad','Artículo elaborado'],
 ['distribuidora','Distribuidoras y mayoristas','Comercio',['rutas','documentos_venta'],['variantes'],'cliente','artículo','pedido','Toma preventas, prepara la ruta y factura la entrega.','Mercadería','caja','Artículo mayorista'],
 ['transporte','Transporte y logística','Servicios',['proyectos','contratos'],[],'cliente','servicio','orden','Registra viajes como proyectos, costos por unidad y facturación.','Viajes','viaje','Servicio de transporte'],
 ['organizacion','Organizaciones, iglesias y asociaciones','Organizaciones',['aportes','contratos'],[],'donante','aporte','recibo','Identifica al socio, donante y fondo antes de emitir el recibo.','Aportes','cuota','Cuota de ejemplo'],
 ['software','Software, tecnología y agencias','Servicios',['proyectos','contratos','documentos_venta'],['agenda','comisiones'],'cliente','servicio','factura','Cotiza desarrollo, licencias o soporte y confirma la factura de cada entrega o período.','Servicios tecnológicos','hora','Servicio de soporte'],
 ['recurrentes','Suscripciones y servicios recurrentes','Servicios',['contratos','documentos_venta'],['agenda','reservas'],'suscriptor','servicio','factura','Configura el contrato de mantenimiento o membresía y confirma cada factura del período.','Servicios recurrentes','mes','Mantenimiento mensual'],
 ['comercio_electronico','Comercio electrónico y venta en línea','Comercio',['documentos_venta','despacho','rutas'],['variantes'],'cliente','producto','pedido','Prepara el pedido en línea, confirma la factura y registra el despacho.','Catálogo en línea','unidad','Artículo de venta en línea'],
 ['freelance','Freelance y consultoría individual','Servicios',['proyectos','documentos_venta'],['agenda','contratos'],'cliente','servicio','factura','Cotiza horas o entregables y confirma la factura del trabajo realizado.','Consultoría','hora','Sesión de consultoría'],
 ['inmobiliaria','Inmobiliaria e intermediación','Servicios',['proyectos','documentos_venta','comisiones'],['contratos','agenda'],'cliente','servicio','factura','Registra la intermediación, confirma los honorarios y revisa la comisión vinculada.','Intermediación','servicio','Servicio de intermediación'],
 ['seguros','Seguros y corretaje','Servicios',['contratos','documentos_venta','comisiones'],['agenda','proyectos'],'cliente','servicio','factura','Registra el servicio de corretaje, confirma sus honorarios y revisa la comisión.','Corretaje','servicio','Servicio de corretaje'],
 ['personalizado','Personalizado','Personalizado',[],all,'cliente','producto','factura','Elige módulos y etiquetas en Personalizar mi sistema.','General','unidad','Artículo de ejemplo']
 ];
 const serviceProfiles=new Set(['catering','profesionales','belleza','salud','educacion','gimnasio','taller','lavanderia','hotel','alquiler','prestamista','construccion','transporte','organizacion','software','recurrentes','freelance','inmobiliaria','seguros']);
 const serviceOperations=new Set(['profesionales','software','freelance','inmobiliaria','seguros','recurrentes','belleza','salud','educacion','gimnasio','taller','lavanderia','transporte']);
 for(const row of rows)if(serviceOperations.has(row[0])){row[3]=[...new Set([...row[3],'agenda','proyectos','contratos','comisiones','documentos_venta'])];row[4]=row[4].filter(m=>!row[3].includes(m));}
 const inventoryRoutes=['kardex','traslados','compras'];
 for(const row of rows){if(row[0]!=='personalizado')row[4]=[...row[4],'bancos','flujo_proyectado','pagos_lote','anticipos','revalorizacion','tipos_cambio'];if(['software','recurrentes'].includes(row[0]))row[3]=[...row[3],'suscripciones'];else if(row[0]!=='personalizado')row[4]=[...row[4],'suscripciones'];}
 const profiles=rows.map(([id,name,group,active,optional,customer,product,document,flow,category,unit,example])=>({id,name,description:flow,group,serviceFirst:serviceProfiles.has(id),capabilities:active,optionalCapabilities:optional,modules:id==='comercio'?null:[...common,...active,'comprobantes'],labels:{customer,product,document},salesFlow:flow,quickQuestions:[[active[0]||'facturacion','¿Cómo empiezo en '+name.toLowerCase()+'?',flow+' Usa Más módulos para consultar otras herramientas.'],['facturacion','¿Cómo cobro?', 'Abre Facturación. Selecciona '+product+', confirma cantidad, precio e IVA y registra el pago. Las operaciones de rubro se facturan una sola vez desde su ficha.']],startup:{categories:[category],units:[unit],examples:[{name:example,unit,category,kind:serviceProfiles.has(id)||['servicio','hora','mes','consulta','noche','día','viaje','cuota'].includes(unit)?'service':'stock'}]}}));
 for(const p of profiles)if(['restaurante','comida_rapida','catering','panaderia'].includes(p.id))p.quickQuestions.push(['cuentas_abiertas','¿Cómo envío a cocina sin facturar dos veces?','Abre la cuenta y usa Enviar ronda a cocina / barra. Selecciona estación y consumos pendientes. Despacho prepara; solo la cuenta emite factura.']);
 for(const p of profiles)if(serviceOperations.has(p.id))p.quickQuestions.push(['proyectos','¿Cómo uso bonos, tiempo y seguimiento de servicios?','Abre Atención y seguimiento en la ficha. En Proyectos registra tiempo y avance, convierte una cotización o configura un bono con anticipo; factura cada prestación como etapa única. En Contratos confirma la renovación. Los avisos son internos. Verifica con tu contador.']);
 for(const p of profiles)if(['recurrentes','software'].includes(p.id))p.quickQuestions.push(['suscripciones','¿Cómo creo un plan de servicio y registro uso?','En Suscripciones y facturación recurrente usa Crear plan. Selecciónalo al dar de alta al cliente, registra uso dentro del límite y confirma cada factura. Los cupones requieren autorización de descuento; las gestiones de cobranza son manuales. Verifica con tu contador.']);
 for(const p of profiles)if(p.id==='organizacion')p.quickQuestions.push(['aportes','¿Cómo registro socios, campañas y cuotas?','En Donaciones, cuotas y aportes crea primero un fondo y luego el socio. Registra cada aporte o cuota con confirmación. Consulta avance, atrasos y la constancia anual. Los avisos son internos. Verifica con tu contador.']);
 // Solo presentación: debe comprobarse routeAllowed antes de usar esta recomendación.
 const hasInventory=products=>Array.isArray(products)&&products.some(p=>p&&p.kind!=='service');
 const inventoryVisible=(profile,products)=>!profile.serviceFirst||hasInventory(products);
 const get=id=>profiles.find(p=>p.id===id)||profiles[0];
 const operationalType=company=>company?.businessType==='personalizado'?(company.businessCustomization?.operationalProfile||'comercio'):(company?.businessType||'comercio');
 const resourceLabel=id=>({restaurante:'Mesa',comida_rapida:'Mesa',catering:'Mesa',panaderia:'Mostrador',hotel:'Habitación',belleza:'Sillón',salud:'Consultorio',taller:'Equipo',alquiler:'Unidad'}[id]||'Recurso');
 const moduleLabels=Object.fromEntries(all.map(id=>[id,capabilities[id].name]));
 globalThis.AcontecProfiles=Object.freeze({profiles,capabilities,moduleLabels,get,all,hasInventory,inventoryVisible,inventoryRoutes,resourceLabel,operationalType});
})();
