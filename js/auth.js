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
  logoutBtn.addEventListener('click', async () => { 
    await sb.auth.signOut(); 
    location.href = 'index.html'; 
  });
}

// DASHBOARD GUARD (Bulletproof)
(async () => {
  if (!location.pathname.includes('dashboard.html')) return;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { 
    location.href = 'login.html'; 
    return; 
  }

  // 1. Set User Info (dengan safety check)
  const name = session.user.user_metadata?.full_name || 'User';
  const userNameEl = document.getElementById('userName');
  const userEmailEl = document.getElementById('userEmail');
  const avatarEl = document.getElementById('avatar');

  if (userNameEl) userNameEl.textContent = name;
  if (userEmailEl) userEmailEl.textContent = session.user.email;
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

  // 2. Load Data secara berurutan dan aman
  console.log('🔄 Memuat data dashboard...');
  try {
    if (typeof loadProfile === 'function') await loadProfile();
    if (typeof loadProducts === 'function') await loadProducts();
    if (typeof loadOrders === 'function') await loadOrders();
    console.log('✅ Dashboard berhasil dimuat!');
  } catch (err) {
    console.error('❌ Error saat memuat dashboard:', err);
    toast('Gagal memuat data. Cek console (F12).', 'error');
  }
})();
