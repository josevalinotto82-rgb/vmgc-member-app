// El gestor del teléfono conserva las contraseñas. La app solo las usa para ingresar.
export function setupCredentials(Capacitor, registerPlugin) {
  const form = document.getElementById('loginForm');
  if (!form || !['ios', 'android'].includes(Capacitor.getPlatform())) return;
  const credentials = registerPlugin('ClubCredentials');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Usar contraseña guardada';
  button.style.marginTop = '12px';
  form.append(button);
  let offered = false;
  let selected = null;
  async function fill(automatic = false) {
    if (button.disabled) return;
    button.disabled = true;
    const before = {email: email.value, password: password.value};
    try {
      const result = await credentials.savedPassword();
      if (result.cancelled || result.unavailable || !result.username || !result.password) {
        if (!automatic && result.unavailable) document.getElementById('msg').textContent = 'No se encontró una contraseña guardada para Villa María Golf.';
        return;
      }
      // No reemplazar lo que alguien empezó a escribir mientras se abría el gestor.
      if (automatic && (email.value !== before.email || password.value !== before.password)) return;
      email.value = result.username;
      password.value = result.password;
      selected = {email: result.username.trim(), password: result.password};
      for (const input of [email, password]) {
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
      }
      document.getElementById('loginBtn').focus();
    } catch {
      if (!automatic) document.getElementById('msg').textContent = 'No se pudo abrir el gestor de contraseñas. Podés ingresar tu email y contraseña.';
    } finally { button.disabled = false; }
  }
  button.addEventListener('click', () => void fill());
  window.offerClubSavedPassword = async () => {
    if (offered || email.value || password.value) return;
    offered = true;
    await fill(true);
  };
  if (Capacitor.getPlatform() === 'android') {
    const autofill = registerPlugin('ClubAutofill');
    window.commitClubLogin = async ({email: username, password: secret}) => {
      // Lo recuperado del gestor ya está guardado. Solo se ofrece guardar un ingreso manual correcto.
      if (selected?.email === username && selected?.password === secret) return;
      try {
        const result = await credentials.savePassword({username, password: secret});
        if (result.unavailable) await autofill.commit();
      } catch { try { await autofill.commit(); } catch {} }
    };
  }
}
