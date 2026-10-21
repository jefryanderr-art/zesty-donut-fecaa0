# Fase 0: almacenamiento relacional en Netlify Database

Se mantuvo Netlify Database (Postgres) por decisión del propietario. No se conectó Supabase. El frontend sigue siendo estático y conserva su contrato actual: los importes que recibe y muestra están en unidades monetarias. El servidor convierte los importes a centavos enteros para persistirlos en las tablas relacionales. Esta fase no cambia los algoritmos de cálculo del navegador ni implementa las fases contables posteriores.

## Despliegue y seguridad

La plataforma aplica la migración nueva durante el despliegue. No ejecutar `drizzle-kit push`, `drizzle-kit migrate` ni modificar las cuatro migraciones previamente aplicadas. El script de datos se ejecuta **después** de que el despliegue termine correctamente, una empresa por operación. Las empresas nuevas se normalizan automáticamente en el primer guardado desde un documento nulo. Las empresas existentes sin convertir continúan leyendo y guardando su JSON habitual; el despliegue no intenta convertir todos sus registros ni bloquea su publicación por una inconsistencia histórica.

Drizzle conserva el adaptador Netlify y las versiones beta existentes. La conexión la administra Netlify; no se necesita una cadena nueva, claves de Supabase ni variables públicas. El script debe ejecutarse en un entorno de servidor autorizado con la configuración privada de Netlify Database inyectada de forma segura. No pegar valores en argumentos, código, documentación ni registros. No ejecutarlo en el navegador ni incluirlo en los archivos publicados.

RLS se habilita en todas las tablas de la aplicación. La política permite operaciones únicamente a roles de base de datos que ya tengan permiso UPDATE sobre `acontec_companies`; excluye expresamente los roles `anon` y `authenticated`. No se expone acceso SQL al navegador. Un rol de inspección de solo lectura no supera esa política. Los propietarios de tablas pueden omitir RLS conforme a Postgres; no se usa FORCE RLS ni se cambia la autenticación existente. Debe verificarse el permiso del rol real de Functions en la vista previa antes de publicar. El aislamiento entre empresas y los módulos siguen validándose en el servidor con la sesión y los permisos actuales; esta política no sustituye esa autorización.

## Tablas y representación

El esquema contiene tablas para cuentas, productos, clientes, proveedores, empleados, nóminas, liquidaciones, obligaciones fiscales, propiedades, turnos, movimientos de caja, fondos y comprobantes de caja chica, arqueos, catálogo y registros de costos, asientos, líneas, facturas, artículos, pagos y movimientos de inventario. Las claves principales incluyen empresa e identificador histórico; las tablas operativas tienen índices por empresa y fecha. Los hijos de asientos referencian la clave compuesta empresa/asiento. Los importes principales usan BIGINT en centavos, limitado al rango entero seguro de JavaScript; cantidades usan NUMERIC y las tasas conservan su precisión.

Cada registro conserva metadatos complementarios en `extra`, incluyendo campos históricos y su presencia o ausencia. Los importes monetarios conocidos que permanecen en esos metadatos también se codifican como centavos enteros. La configuración, los consecutivos y los campos superiores no normalizados quedan en `document_extra`. No se elimina información desconocida. Agregar un nuevo campo monetario requiere declararlo en el contrato compartido o en la codificación residual, además de su migración si necesita una columna consultable.

Las tablas de facturas son una proyección del mismo asiento que usa hoy Facturación/Ventas/Compras; no crean ventas ni movimientos adicionales. Las fechas del documento se mantienen como texto ISO para conservar el contrato histórico. Los índices de fecha de clientes, productos o cuentas sin fecha quedan nulos.

## Verificar, convertir y volver al JSON

Obtén el UUID y la revisión vigente de la empresa desde la respuesta autenticada de `/api/data?c=UUID`. No uses una revisión inventada. En un entorno de servidor con Node 22 y acceso autorizado a esa rama de Netlify Database:

```sh
npm run storage:migrate -- --company UUID --revision N
npm run storage:migrate -- --company UUID --revision N --apply
npm run storage:migrate -- --company UUID --revision N
```

La primera orden solo verifica el origen, sin escrituras ni bitácora. Comprueba identificadores únicos, cuentas de las líneas, importes finitos representables en centavos, debe igual a haber **por asiento**, conteos, totales globales y reconstrucción completa mediante SHA-256 canónico. No corrige ni redondea los registros históricos: cualquier fracción de centavo, desbalance o referencia inválida detiene la conversión. Resolver esos casos con ajustes contables y revisión del responsable antes de reintentar.

`--apply` bloquea la fila de empresa, exige la revisión indicada, conserva una copia inicial en `acontec_accounting_origins` independiente de la rotación de las últimas 30 versiones, copia las filas, vuelve a leer lo almacenado y compara conteos, relaciones, fechas, todos los campos y totales. Solo entonces confirma la transacción y activa `relational`. Cualquier fallo revierte toda la operación. La revisión contable no aumenta por cambiar el almacenamiento y la operación queda en la bitácora. Las siguientes escrituras actualizan JSON, diferencias relacionales, revisión, respaldo y bitácora en la misma transacción. No hay sondeos, tareas programadas ni copia masiva en cada guardado; solo se insertan/actualizan las filas modificadas y se retiran de la proyección las eliminadas por una operación contable autorizada.

Para volver al modo anterior sin borrar nada:

```sh
npm run storage:migrate -- --company UUID --revision N --rollback
```

Se comprueba la copia JSON vigente y se cambia el modo a `legacy`. Esto conserva las operaciones más recientes: no reemplaza los datos por la copia inicial. Las tablas relacionales y el origen inicial quedan intactos. Los guardados posteriores en modo legacy actualizan el JSON y sus respaldos como antes; para reactivar lo relacional hay que ejecutar de nuevo `--apply`, que reconstruye y verifica desde el JSON vigente. Para volver a una versión contable pasada, usar la restauración de respaldos existente, que también sincroniza las tablas si el modo es relacional. No hay orden para borrar el origen. Los comprobantes referenciados en esa copia inicial se incluyen en los límites de 100 archivos/50 MB y se excluyen de la limpieza de versiones antiguas.

También existe `POST /api/storage-migration?c=UUID`, con JSON `{ "action": "verify", "revision": N }`; las acciones admitidas son `verify`, `apply` y `rollback`. Exige sesión del dueño de esa empresa, origen del sitio, JSON y aceptación legal vigente. Un administrador sin propiedad de esa empresa y los colaboradores no pueden ejecutarlo. Los operadores del script tienen acceso administrativo al servidor y actúan en nombre del dueño; el comando no concede esa facultad a clientes. Nunca envíes credenciales a esta ruta ni las guardes en localStorage.

## Validación y alcance pendiente

Se prepararon casos automáticos del conversor en `tests/accounting-codec.test.mjs`. Cubren reconstrucción, centavos, documentos vacíos, claves compuestas, duplicados, cuentas inválidas y asientos descuadrados. Deben ejecutarse en la validación de la plataforma con `node --test tests/accounting-codec.test.mjs`; no sustituyen las pruebas con Postgres, permisos ni datos reales. No se ejecutaron compilaciones, servidores ni pruebas locales en la sesión gestionada.

Después del despliegue: verificar que Functions puede usar las tablas con RLS, ingreso por Identity y Google, denegación de acceso directo de roles no autorizados, aislamiento entre dos empresas, bloqueo a colaboradores de la ruta de migración, conversión de una empresa representativa, conteos y sumas antes/después, dos pestañas con revisión obsoleta, guardado/restauración de versiones con comprobantes privados, fallo transaccional sin escrituras parciales y rollback/reconversión después de nuevas operaciones. Confirmar que todas las empresas previstas se convirtieron explícitamente. La migración de datos no se ejecutó durante la edición porque las tablas nuevas todavía dependen del despliegue.

Quedan fuera de esta entrega los precios editables de Crear factura, textos legales y banner, caché del cliente, nuevas reglas de empresas y sucursales, asistentes de IA y las fases 1–10. No se aplicó caché anual a JS/CSS sin versionar: esa mejora requiere su fase de interfaz y una estrategia que permita recibir actualizaciones del sitio.
