# Acceso por correo: diagnóstico y comprobación

## Evidencia y límites

Se consultó el sitio publicado el 30 de octubre de 2026, antes de aplicar la corrección. `GET https://acontec.company/.netlify/identity/settings` respondió HTTP 200: registro abierto, acceso por correo habilitado y autoconfirmación desactivada. La consulta administrativa del proyecto confirmó Identity activo y URL pública `https://acontec.company`.

El rechazo de acceso de una cuenta pendiente es coherente con esa configuración. El fallo comprobado de presentación estaba en el catch interno del login de clientes: reemplazaba errores 400, 401 y 422 por «Correo o contraseña incorrectos» antes de que el catch exterior pudiera reconocer «email not confirmed». El registro mostraba el aviso correcto dentro de `.err`, con estilo rojo. No se inspeccionó la cuenta del video, así que no se atribuye a esa cuenta un estado que no se verificó.

La respuesta pública y la consulta del proyecto no exponen las plantillas, la URL interna de redirección de Identity, la configuración SMTP ni registros de entrega. Esos elementos **no se verificaron**. No hay evidencia de que falte SMTP ni de que un mensaje concreto haya sido enviado, recibido o rechazado. El aviso de registro tampoco prueba entrega.

El enlace ya se leía desde `confirmation_token` en el hash y se enviaba a `/api/confirm`. Esa ruta llamaba a `confirmEmail`, comprobaba `confirmedAt` y luego iniciaba automáticamente una sesión de la aplicación. Faltaba el aviso de confirmación y la pantalla de Ingresar solicitada. La corrección conserva la comprobación de Identity y, para clientes, devuelve únicamente el correo confirmado, sin escribir usuarios, empresas ni sesiones. La pantalla elimina el hash antes de la solicitud, muestra «Correo confirmado. Ya puedes ingresar» y precarga el correo en Ingresar. La emisión habitual de sesión al ingresar, Google y el flujo especial del administrador se conservaron.

## Reenvío

El SDK instalado no tiene una operación dedicada a reenviar confirmación. La implementación pública de Netlify GoTrue ofrece esa operación repitiendo el registro de un usuario pendiente; no cambia su contraseña existente y fusiona los metadatos enviados. Se usa `signup` de `@netlify/identity` con los datos de acceso escritos en el formulario y metadatos vacíos, sin pasar datos de empresa.

Para evitar que el botón permita registrar correos arbitrarios, el servidor exige un permiso aleatorio de 256 bits emitido solamente después de que Identity indique que el correo no está confirmado. Su hash, ligado al correo, caduca a los quince minutos y utiliza la tabla existente de intentos; no es una sesión ni autentica al usuario. El navegador lo conserva únicamente en memoria y lo descarta al escribir o cambiar de pestaña. No se usa localStorage ni se persisten contraseñas.

Hay hasta cinco solicitudes por IP y tres por correo por ventana fija de quince minutos; además, una por correo por ventana de un minuto y hasta tres usos por permiso. Las reservas utilizan escrituras atómicas en la tabla existente de intentos. No se añadieron tablas ni migraciones. Los intentos fallidos también consumen límite. Los límites por correo, permisos inválidos/caducados, cuenta confirmada y fallos de correo reciben la misma respuesta genérica; el límite por IP devuelve 429. La respuesta condicional no afirma entrega. Un permiso caducado requiere volver a intentar Ingresar.

Antes del reenvío se consulta que el registro siga abierto y la autoconfirmación siga desactivada. No debe eliminarse una cuenta pendiente ni cambiarse la política de registro mientras se usa un permiso vigente: GoTrue puede crear una cuenta si fue eliminada entre la emisión del permiso y el reenvío. La operación de registro de GoTrue no ofrece una condición atómica «solo si ya existe»; el permiso evita correos arbitrarios, pero no puede eliminar esa carrera administrativa. No se hicieron eliminaciones ni se cambió la configuración de Identity.

Si el registro está cerrado o el servicio no permite reenviar, la alternativa es asistencia desde el panel de Identity: revisar el estado y las acciones disponibles para ese usuario, y usar invitación o confirmación solo si se ofrecen y están autorizadas. Una recuperación de contraseña no equivale a reenviar confirmación. No se debe habilitar autoconfirmación global en producción para resolver un problema de entrega.

Referencias públicas consultadas: [rutas de GoTrue](https://github.com/netlify/gotrue/blob/master/api/api.go), [registro y reenvío](https://github.com/netlify/gotrue/blob/master/api/signup.go), [envío de confirmación](https://github.com/netlify/gotrue/blob/master/api/mail.go) y [rechazo por correo pendiente](https://github.com/netlify/gotrue/blob/master/api/token.go). Son evidencia del mecanismo publicado, no del resultado de envío de esta instancia.

## Revisión del propietario en Netlify

1. Abrir el proyecto **zesty-donut-fecaa0** y entrar en **Project configuration > Identity**. Comprobar registro **Open** y autoconfirmación desactivada. Es lo observado públicamente; no hace falta cambiarlos para probar la corrección.
2. Revisar la configuración de URL/redirección de Identity y contrastarla con `https://acontec.company`. La URL pública del proyecto ya coincide; la interna de Identity sigue pendiente de verificación.
3. En la configuración de correos de Identity, abrir la plantilla de confirmación. Verificar que conserve el enlace generado por Identity, normalmente `{{ .ConfirmationURL }}`, y que no use un token fijo, un enlace manual o un dominio antiguo. No incluir tokens reales en capturas ni documentación.
4. Revisar remitente y proveedor de correo de Identity. Si hay SMTP personalizado, revisar autenticación, dominio/remitente y registros de envío/rebote del proveedor. No compartir credenciales. El SMTP de la facturación de la aplicación es independiente del correo de Identity.
5. En **Identity > Users**, inspeccionar exclusivamente la cuenta de pruebas autorizada: comprobar estado de confirmación y fecha de envío si aparecen. Una fecha de envío no demuestra llegada al buzón. Revisar también entrada, spam y posibles cuarentenas del destinatario.
6. Si el correo falla, usar únicamente las acciones de invitación/confirmación que el panel realmente ofrezca para esa cuenta. No se verificó aquí la disponibilidad de confirmación manual. Completar el establecimiento de contraseña mediante el mecanismo seguro de Identity y probar el ingreso en la aplicación antes de entregar acceso para certificación.

Los nombres de las secciones del panel pueden variar. No se modificaron plantillas ni configuración de correo durante esta entrega.

## Cómo probar después del despliegue

1. En una ventana privada, registrar una cuenta nueva con un buzón controlado y autorizado. Comprobar aviso verde «Cuenta creada…» en el mismo lugar que los errores. Escribir o cambiar entre Ingresar/Crear cuenta debe borrarlo.
2. Sin confirmar todavía, intentar ingresar. Debe aparecer «Tu correo aún no está confirmado. Revisa tu bandeja de entrada y spam y abre el enlace.» y el botón **Reenviar correo de confirmación**. El proveedor comprueba la confirmación antes de validar la contraseña: ese mensaje no prueba que la contraseña escrita sea correcta.
3. Pulsar reenvío. Comprobar la respuesta genérica, los límites por IP/correo y la recepción real. Si llega un enlace nuevo, usar el último: reenviar puede invalidar el anterior. Verificar también que un permiso inexistente/caducado no registre usuarios ni revele si un correo existe.
4. Abrir el enlace recibido. Comprobar dominio, retirada del token de la dirección, aviso «Correo confirmado. Ya puedes ingresar», pestaña Ingresar y correo precargado. Confirmar en Identity el estado del usuario.
5. Ingresar con la contraseña original y verificar acceso a su empresa. Probar una contraseña incorrecta en una cuenta ya confirmada: debe verse «Correo o contraseña incorrectos». Una caída del servicio debe mostrar indisponibilidad, sin detalles internos.
6. Probar un enlace caducado: debe mostrar un error en el mismo contenedor e indicar intentar Ingresar para solicitar otro correo. Comprobar también validaciones de formulario, móvil y navegación con teclado.
7. Comprobar en el despliegue las reservas concurrentes y permisos de acceso a la tabla de intentos. Las pruebas simuladas no validan RLS ni comportamiento real de Postgres.
8. Comprobar que Google y el administrador conservan el acceso anterior. No alterar la cuenta del administrador para realizar estas comprobaciones.

No se realizó la cadena real registro → correo → enlace → ingreso: no se proporcionó correo de prueba ni acceso a un buzón/panel interactivo. No se creó ni confirmó manualmente una cuenta de Pagadito, ni se contactó a terceros. La certificación queda pendiente hasta comprobar personalmente el ingreso con la cuenta autorizada.

## Verificaciones ejecutadas

Se añadieron doce pruebas del manejo de errores, rutas con Identity simulado, reenvío autorizado/genérico, origen/JSON y flujo del navegador simulado. Todas pasaron. Se comprobó la sintaxis de los archivos JavaScript editados y se actualizaron las huellas de los recursos sin compilar.

La suite completa `npm test` ya fallaba antes del cambio en tres pruebas: extensión de la guía `perfiles_negocio`, comparación de personalización que ahora incluye `invoiceCountry`, y extracción de la operación de planes con `Unexpected token 'export'`. Esos fallos ajenos al acceso se conservaron y se informan por separado. Las pruebas no sustituyen la comprobación real de correo y acceso posterior al despliegue.
