# Alta y reparación de cuentas nuevas

Se unificó la creación inicial en `createOwnedCompany`. El registro por correo entrega sus datos a ese creador; Google solo autentica y, si no hay empresa accesible, presenta el mismo `companyFields` hasta que el dueño confirme. Cerrar y volver a abrir conserva la sesión y vuelve al formulario; el borrador del formulario no se almacena en el navegador.

## Diagnóstico y evidencia

Se consultó `acontec_save_failures` en la rama accesible por los códigos 2EDC9E8670, 63D2992746 y B8E2AF9F29: no hubo filas. No se dispuso de los logs de las invocaciones de producción. Por tanto, **no se puede afirmar que la causa de esos tres incidentes se haya confirmado en logs**.

El código anterior sí contiene una ruta inequívoca de fallo: `ensureAccount` insertaba empresas con `data = null`; `openCompany` creaba un documento mínimo en el navegador y llamaba a `save()`; `updateCompany` entregaba ese documento anterior nulo a `guardBankReconciliations`; su función `records` evaluaba `data.businessRecords` y lanzaba TypeError. El manejador convertía la excepción en el mensaje genérico de error interno. Las empresas con documento previo no recorren esa desreferencia nula. La corrección hace segura esa lectura y elimina la necesidad del primer guardado desde el navegador. Este diagnóstico procede de revisión estática, no de una reproducción ejecutada.

| Hipótesis | Resultado de la revisión |
| --- | --- |
| Migración ausente | Las 23 migraciones previas figuraron aplicadas en la rama consultada. No se comprobó el estado de producción. |
| RLS / rol Functions | No se modificaron políticas. El fallo identificado ocurre en JavaScript antes de escribir la información inicial. El permiso real de Functions requiere verificación tras desplegar; la conexión de inspección no demuestra ese permiso. |
| Guardado al abrir | Confirmado en código: se guardaba al recibir `data = null`, y «Mi empresa» también alteraba `cfg.asked`. Se eliminaron ambos guardados. |
| Revisión simultánea | No hay evidencia de que explique los tres códigos. El guardado del navegador ya se serializaba; la creación ahora bloquea la fila del usuario y comprueba si existe empresa dentro de la transacción. |
| Defaults en operaciones | Se creaba una fila sin documento; `initializeOperations` exigía un documento previo. La creación central entrega ahora todas las colecciones del modelo y normaliza el almacenamiento antes de confirmar la transacción. |

## Archivos y comportamiento

- `db/accounting-model.mjs`: constructor aditivo del documento, colecciones, configuración fiscal y metadatos del ciclo del perfil. No introduce importes nuevos en coma flotante.
- `netlify/lib/business-profile.mjs`: catálogo inicial por perfil y confirmación del perfil pendiente. Los ejemplos de productos siguen siendo opcionales, sin precios ni saldos inventados. Las cuentas especializadas se agregan sin sustituir las históricas.
- `netlify/lib/access.mjs`: único creador, bloqueo por usuario, inicialización JSON/relacional, auditoría y bloqueo de escrituras ordinarias mientras el perfil esté pendiente.
- `netlify/lib/operations.mjs`: operación idempotente `completeProfile`, con dueño, permiso de ajustes y revisión. Los metadatos de confirmación no se pueden alterar mediante el guardado genérico.
- `netlify/lib/banks.mjs`: lectura segura del documento anterior nulo.
- `netlify/functions/api.mjs`: Google sin creación implícita, alta inicial autenticada e idempotente, reparación transaccional al abrir la empresa y categorías seguras de diagnóstico sin documentos ni excepciones privadas.
- `public/app.js`, `public/business.js` y `public/billing.js`: formulario común de nombre, perfil, país, moneda e identificación; bloqueo del doble envío; errores con reintento; apertura sin guardado inicial y sin ocultar fallos de lectura tras una sesión autenticada. La actualización automática de suscripción espera a tener empresa y perfil completo.
- `public/platform-editor.js`: aviso de almacenamiento calculado antes de escapar el texto. Se revisaron los textos literales de `uiT` de los JavaScript públicos buscando otras interpolaciones crudas; no se encontraron más.
- Migración `20261105163711_repair_company_initial_defaults`: cola persistente aditiva e idempotente de reparación. `public/index.html` y el manifiesto de migraciones se actualizaron mediante el versionador existente.
- `netlify/lib/assistant-guide.mjs` y `public/assistant.js`: instrucciones y respuesta rápida sobre el formulario real, sin consultas de datos de clientes.
- `tests/new-company-onboarding.test.mjs`: pruebas de creador compartido, repetición, normalización, apertura sin guardado, reparación conservadora, perfil único, cuentas con movimientos y texto de almacenamiento. Incluye dobles de infraestructura y comprobaciones de contratos de los flujos; no sustituye las verificaciones HTTP reales.

## Reparación y límites

La migración **programa** la reparación; el documento se completa cuando su dueño abre la empresa. No escribe JSON contable directamente desde SQL porque eso dejaría obsoletos el hash, el manifiesto y la proyección relacional. El procesamiento usa `updateCompany` con bloqueo, revisión, respaldo, bitácora y sincronización de ambas representaciones. La eliminación de la tarea y el guardado se confirman juntos; un fallo conserva la tarea y muestra un botón para reintentar. No se ejecutó la migración en esta sesión.

La selección incluye documentos nulos, colecciones ausentes y claves ausentes de la configuración inicial, fiscal y de dimensiones. La consulta de selección en la rama disponible devolvió cero candidatas; no demuestra el estado de producción. Agrega campos sin reemplazar valores ya presentes; no corrige registros inválidos, saldos ni fracciones de centavo. Una empresa completa, sin indicios de perfil pendiente, no entra en la cola ni cambia de revisión.

No había un campo de procedencia del alta. Para solicitar confirmación del perfil histórico se usan conjuntamente: arranque aún pendiente, perfil Comercio, nombre personal recibido de Google y ausencia de auditoría de creación o cambio de perfil. Es una **heurística conservadora, no una identificación infalible del proveedor inicial**: una cuenta manual que luego usó Google puede cumplirla. Los nombres «oas» y «Mi empresa» no se usan como autorización ni como prueba del proveedor. Una empresa que completó el arranque puede haber recibido originalmente un perfil automático y no será identificable con certeza mediante estos datos. Revisar estos casos tras desplegar; no se alteraron empresas de producción durante esta sesión.

El catálogo inicial usa las recomendaciones del perfil y cuentas aditivas de la plantilla existente, con sector de servicios para los perfiles `serviceFirst` y comercio para los demás. No reemplaza una selección explícita posterior de sector económico. Sin movimientos, completar el perfil agrega sus recomendaciones y cuentas; con asientos, existencias, registros de negocio, nóminas o documentos extranjeros, conserva íntegramente las cuentas y muestra la limitación al dueño. El formulario queda completado y la auditoría registra el cambio de configuración y perfil.

Los módulos que requieren activación siguen apagados por sus reglas existentes: colecciones vacías no contienen registros de activación, no hay controles habilitados ni capas PEPS, y `assistant_enabled` conserva su valor inicial falso. No se habilita ningún módulo durante la reparación. Los campos del perfil en `cfg` viajan por el codec residual, respaldos y exportaciones existentes; el perfil superior conserva los campos de respaldo ya disponibles.

## Verificación posterior al despliegue

1. Confirmar la migración nueva, el manifiesto de salud y el rol real de Functions. Verificar lectura/escritura RLS sin usar el navegador para conexiones SQL.
2. Registrar una cuenta manual con nombre, modelo, país, moneda e identificación. Confirmar correo, ingresar y comprobar esos datos. Observar en red que abrir la app no genera `PUT /api/data` para inicializarla; verificar primera operación y respaldo.
3. Acceder con una cuenta nueva de Google. Comprobar sesión autenticada sin empresa creada. Interrumpir el formulario y volver a entrar: debe reaparecer sin empresa por defecto. Confirmar los mismos datos del caso manual y comparar colecciones/configuración iniciales, ignorando identificadores y auditoría.
4. Repetir el envío y simular respuesta perdida/recarga: debe existir una sola empresa propia. Entrar con Google en una cuenta con empresa previa: debe abrir directamente su panel.
5. Entrar como dueño de «oas» y «Mi empresa». Revisar si fueron seleccionadas por la migración, la entrada «Reparación de campos iniciales», el respaldo anterior, los valores conservados y la revisión nueva. Si están pendientes, completar el formulario y volver a ingresar: no debe repetirse.
6. En una empresa pendiente con movimientos, comparar todas las cuentas y los asientos antes/después, incluidos los de otras sucursales; deben permanecer iguales. Confirmar el aviso. En una pendiente sin movimientos, verificar las recomendaciones del perfil elegido.
7. Comparar documento y revisión de una empresa antigua completa, sin perfil pendiente, antes y después de abrirla. Verificar colaboradores, planes y acceso por API a los datos de otras empresas: deben conservar sus restricciones.
8. Simular fallo de reparación y conflicto de revisión: debe conservarse el respaldo y la tarea, mostrarse el error con reintento y no sobrescribirse la otra pestaña. Confirmar idempotencia de `completeProfile` tras respuesta perdida.
9. Exportar, respaldar y restaurar una empresa de prueba. Comprobar perfil y metadatos nuevos, JSON y representación relacional, sin pérdida de datos ni alteración de centavos.
10. Verificar almacenamiento sin umbral, bajo umbral y al 70 %, móvil y oscuro. No debe aparecer `${` como expresión sin interpolar.

Solo se ejecutaron comprobaciones de sintaxis `node --check` y revisión estática. No se ejecutaron las pruebas, servidores ni compilaciones. La plataforma debe ejecutar la suite y las verificaciones funcionales anteriores; no se afirma que hayan pasado.
