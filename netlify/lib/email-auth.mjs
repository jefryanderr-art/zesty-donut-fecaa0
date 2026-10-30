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
export async function resendConfirmation({ email, password, grant, consume, settings, signup }) {
  if (!await consume(email, grant)) return;
  try {
    const config = await settings();
    if (config.disableSignup || config.autoconfirm) return;
    await signup(email, password);
  } catch {
    // Same public response for expired grants, confirmed/deleted users,
    // throttling, delivery failures and provider errors. Never log contents.
  }
}
