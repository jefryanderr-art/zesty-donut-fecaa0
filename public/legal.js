/* Datos legales de Acontec. EDITA SOLO ESTE OBJETO; las páginas se llenan solas. */
(() => {
  const L = (window.LEGAL = {
    brand: 'Acontec',
    owner: '',                    // nombre o razón social del titular
    ruc: '',                             // RUC (si lo tienes; si está vacío, no se muestra)
    country: 'Nicaragua',
    address: '',
    email: 'jefryanderr@gmail.com',      // correo de contacto y de solicitudes de privacidad
    site: 'https://acontec.company',
    updated: '22 de octubre de 2026',
    version: '2026-10-22',               // debe coincidir con LEGAL_VERSION en config.mjs
    retentionDays: 90,                   // días que se conservan los datos tras cancelar
    refundDays: 7                        // días para pedir reembolso tras el primer pago
  });

  const run = () => {
    document.querySelectorAll('[data-legal]').forEach((e) => { e.textContent = L[e.dataset.legal] ?? ''; });
    document.querySelectorAll('[data-legal-mail]').forEach((a) => { a.href = 'mailto:' + L.email; a.textContent = L.email; });
    document.querySelectorAll('[data-legal-if]').forEach((e) => { if (!L[e.dataset.legalIf]) e.remove(); });
    document.querySelectorAll('[data-legal-footer]').forEach((e) => {
      e.innerHTML = '<nav class="lg-foot"><a href="/privacidad">Política de Privacidad</a> · <a href="/terminos">Términos y Condiciones</a> · <a href="/reembolsos">Reembolsos y cancelaciones</a> · <a href="/cookies">Política de cookies</a><br><span>© ' + new Date().getFullYear() + ' ' + L.brand + '. Precios en dólares (USD).</span></nav>';
    });
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run();
})();

// La versión aprobada se lee de nuevo al abrir la página; nunca se reutiliza una copia contractual en caché.
(async()=>{const key={ '/cookies':'cookies','/cookies.html':'cookies','/terminos':'terms','/terminos.html':'terms','/privacidad':'privacy','/privacidad.html':'privacy','/reembolsos':'refunds','/reembolsos.html':'refunds'}[location.pathname];if(!key)return;try{const response=await fetch('/api/legal',{cache:'no-store'});if(!response.ok)throw new Error();const doc=await response.json(),main=document.querySelector('main.lg');if(!main)return;const status=document.createElement('p');status.className='lg-box';status.textContent=doc.approved?'Documento aprobado · versión '+doc.version:'Borrador pendiente de aprobación del titular. La contratación permanece deshabilitada.';main.prepend(status);if(doc.approved){const title=document.createElement('h1');title.textContent={terms:'Términos y Condiciones',privacy:'Política de Privacidad',refunds:'Reembolsos y Cancelaciones',cookies:'Política de cookies'}[key];const text=document.createElement('div');text.style.whiteSpace='pre-wrap';text.textContent=doc[key]||(key==='cookies'?'Utilizamos cookies técnicas para mantener tu sesión y almacenamiento local para preferencias. No usamos cookies publicitarias. Puedes bloquearlas desde tu navegador; bloquear las esenciales impide iniciar sesión.':'Documento pendiente de publicación.');main.replaceChildren(status,title,text)}}catch{const main=document.querySelector('main.lg');if(main){const p=document.createElement('p');p.textContent='No se pudo verificar la versión vigente. Recarga antes de contratar.';main.prepend(p)}}})();
