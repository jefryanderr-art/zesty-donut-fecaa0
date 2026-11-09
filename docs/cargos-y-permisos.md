# Cargos y permisos por empresa

Accesibilidad incorpora cargos con nombre, descripción, permisos Ver/Crear/Editar/Borrar por módulo y autorizaciones especiales. La interfaz mantiene los controles y tarjetas existentes, con casillas que se distribuyen en dos columnas en pantallas pequeñas. Solo el dueño o un acceso con permiso de administrar accesos puede consultar o modificar esta sección, también desde la API.

La migración agrega una tabla de cargos con RLS y dos columnas opcionales en los accesos. No actualiza accesos existentes ni documentos contables. Los cinco cargos iniciales se materializan como plantillas al abrir Accesibilidad por primera vez en cada empresa. Se conservan como cargos iniciales editables; los cargos personalizados admiten eliminación con reasignación confirmada. El vínculo entre acceso y cargo tiene una clave foránea compuesta por empresa para impedir asignaciones entre empresas.

Los accesos anteriores mantienen sus matrices y restricciones históricas sin reasignación automática. Se muestran como excepciones individuales. Editar una plantilla no reemplaza esas excepciones. El administrador puede conservarlas, aplicar explícitamente los permisos del cargo o establecer excepciones para un acceso. Los cambios usan revisión del acceso o cargo, bloqueo de la empresa, auditoría y revocación de sesiones. Los administradores no pueden modificar su propio acceso o cargo, modificar al dueño ni conceder permisos o alcances superiores a los suyos. El dueño sigue siendo el propietario de la empresa, fuera del catálogo de cargos.

Los permisos limitan operaciones existentes; no habilitan el borrado de documentos protegidos ni sustituyen requisitos de plan, confirmación, sucursal o cierre. Los permisos especiales de descuentos conservan la contraseña del dueño, vigencias y comprobaciones actuales. Las comprobaciones de CRUD se aplican también al guardado del documento contable; las escrituras derivadas de operaciones protegidas conservan su tratamiento contable.

La configuración de valores negativos reside en la columna de la empresa. Las copias operativas y respuestas al navegador reciben la opción, mientras el documento persistido y la normalización quedan libres de ese campo. La compatibilidad histórica exige una huella de origen válida y equivalencia de todos los demás campos, además de los conteos, totales y filas relacionales. No se modifica la revisión optimista ni se ejecuta una migración de documentos por este cambio.

## Verificación

Se añadieron pruebas para apertura de turno relacional con la opción encendida y apagada, campos históricos con ambos valores, revisión obsoleta, rechazo de corrupción fuera del campo, límites de delegación, CRUD, conservación de excepciones y aislamiento entre empresas. Se revisaron estáticamente el código y la sintaxis. No se ejecutaron pruebas, servidores ni compilaciones locales.

Tras el despliegue quedan pendientes la ejecución de las pruebas por la plataforma, aplicación de la migración y comprobación de RLS con el rol real de Functions; los flujos de alta/edición/reasignación, revocación de sesiones, acceso directo a URL/API y protección del dueño; las operaciones reales con permisos separados y planes distintos; apertura de turno con ambas políticas; y revisión visual y con teclado en celular, tablet, laptop, PC y modo oscuro.
