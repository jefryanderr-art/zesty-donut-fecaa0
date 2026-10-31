// Public messages never include Identity response bodies or credentials.
export const UNCONFIRMED_MESSAGE = 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada y spam y abre el enlace.';
export const RESEND_MESSAGE = 'Si el correo sigue pendiente de confirmación y la solicitud puede procesarse, recibirás un nuevo enlace. Revisa tu bandeja de entrada y spam. Si no llega, contacta con la administración del sitio.';
export function isUnconfirmed(error) {
  return /email[ _-]*(?:not[ _-]*(?:confirmed|verified)|unconfirmed|unverified)|(?:email|e-mail|correo).{0,30}(?:not (?:yet |been )?(?:confirmed|verified)|unconfirmed|unverified|sin confirmar|no (?:ha sido )?confirmado)|email[ _-]*(?:confirmation|verification)[ _-]*required|confirm (?:your|the) email/i.test(String(error?.message || ''));
}
export const identityStatus = error => error?.status ?? error?.cause?.status;
export function loginFailure(error) {
  const status = identityStatus(error);
  if (isUnconfirmed(error)) return { error: UNCONFIRMED_MESSAGE, code: 'EMAIL_UNCONFIRMED', status: 403 };
  if (status === 429) return { error: 'Demasiados intentos. Espera unos minutos antes de volver a ingresar.', status: 429 };
  if ([400, 401, 422].includes(status) && /(?:invalid|incorrect|wrong).{0,30}(?:credentials|password|email or password)|(?:email|password).{0,30}(?:invalid|incorrect)|no user found with that email/i.test(String(error?.message || ''))) {
    return { error: 'Correo o contraseña incorrectos', status: 401 };
  }
  if ([400, 401, 422].includes(status)) return { error: 'No se pudo ingresar. Revisa los datos e inténtalo de nuevo.', status: 400 };
  return { error: 'El servicio de acceso no está disponible en este momento. Intenta de nuevo más tarde.', status: 503 };
}
// Only an unexpired grant issued after Identity rejected an unconfirmed login
// can reach signup. Existing unconfirmed GoTrue users receive another email;
// no metadata is supplied and the existing password is preserved.
export async function resendConfirmation({ email, password, grant, consume, settings, signup, report = async () => {} }) {
  if (!await consume(email, grant)) return;
  try {
    const config = await settings();
    if (config.disableSignup || config.autoconfirm) return;
    await signup(email, password);
  } catch (error) {
    await report(error);
    // Same public response for expired grants, confirmed/deleted users,
    // throttling, delivery failures and provider errors. Never log contents.
  }
}

export const RECOVERY_ERROR = 'No pudimos enviar el correo ahora. Inténtalo de nuevo en unos minutos.';
export const RESET_ERROR = 'El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.';
// A missing endpoint is not proof that the user is absent. Require a user-specific code/message.
export function missingIdentityUser(error) {
  return [400, 404, 422].includes(identityStatus(error)) && /user[_ -]not[_ -]found|no user found|user does not exist/i.test(String(error?.code || error?.cause?.code || '') + ' ' + String(error?.message || ''));
}
export function accessMailError(action, error) {
  const raw = Number(identityStatus(error));
  const status = Number.isInteger(raw) && raw >= 400 && raw <= 599 ? raw : 503;
  const code = status === 429 ? 'RATE_LIMIT' : status >= 500 ? 'SERVICE_UNAVAILABLE' : 'MAIL_REQUEST_REJECTED';
  return { action, code, status };
}
export function attemptScopes(request, context, action, body) {
  const address = context?.ip || request.headers.get('x-nf-client-connection-ip') || '';
  const subject = String(body.email || body.username || body.token || '').trim().toLowerCase();
  const maximum = ({login:30,register:10,'forgot-password':5,'reset-password':10,confirm:15,'resend-confirmation':5,'worker-login':30})[action] || 30;
  // Without a trusted IP, isolate by subject; never pool all visitors under "unknown".
  return { address, subject, maximum, action };
}
