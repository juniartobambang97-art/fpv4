async function checkSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// REGISTER
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('regBtn');
    const msg = document.getElementById('msg');
    msg.textContent = '';
    const fullname = document.getElementById('fullname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setLoading(btn, true, 'Mendaftarkan…');
    const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullname } } });
    setLoading(btn, false);

    if (error) { msg.textContent = error.message; toast('❌ ' + error.message, 'error'); } 
    else { toast('✅ Daftar berhasil! Silakan login.'); setTimeout(() => location.href = 'login.html', 1200); }
  });
}

// LOGIN
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const msg = document.getElementById('msg');
    msg.textContent = '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setLoading(btn, true, 'Memverifikasi…');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    setLoading(btn, false);

    if (error) { msg.textContent = error.message; toast('❌ ' + error.message, 'error'); } 
    else { 
      toast('✅ Login berhasil!'); 
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect') || 'dashboard.html';
      setTimeout(() => location.href = redirect, 800); 
    }
  });
}

// LOGOUT
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => { await sb.auth.signOut(); location.href = 'index.html'; });
}

// DASHBOARD GUARD
(async () => {
  if (!location.pathname.includes('dashboard.html')) return;
  const session = await checkSession();
  if (!session) { location.href = 'login.html'; return; }

  const name = session.user.user_metadata?.full_name || 'User';
  document.getElementById('userName').textContent = name;
  document.getElementById('userEmail').textContent = session.user.email;
  document.getElementById('avatar').textContent = name.charAt(0).toUpperCase();

  await loadProfile();
  await loadProducts();
  await loadOrders(); // <-- TAMBAHAN BARU
})();
