// ---------- AUTH ----------
let currentUser = null;

async function getDashboardUser() {
  if (currentUser) return currentUser;

  const { data, error } = await sb.auth.getSession();
  if (error) throw error;

  const session = data?.session;
  if (!session?.user) {
    location.href = 'login.html';
    return null;
  }

  currentUser = session.user;
  return currentUser;
}

async function checkSession() {
  const user = await getDashboardUser();
  return user;
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

    try {
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullname } }
      });

      if (error) throw error;

      toast('✅ Daftar berhasil! Silakan login.');
      setTimeout(() => location.href = 'login.html', 1200);
    } catch (err) {
      msg.textContent = err.message;
      toast('❌ ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
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

    try {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      toast('✅ Login berhasil!');

      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || 'dashboard.html';

      setTimeout(() => location.href = redirect, 800);
    } catch (err) {
      msg.textContent = err.message;
      toast('❌ ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

// LOGOUT
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await sb.auth.signOut();
    } finally {
      currentUser = null;
      location.href = 'index.html';
    }
  });
}

// DASHBOARD
(async () => {
  if (!location.pathname.endsWith('/dashboard.html') &&
      !location.pathname.endsWith('dashboard.html')) return;

  const loadingTimer = setTimeout(() => {
    toast('Dashboard masih memuat. Periksa koneksi Supabase.', 'error');
  }, 10000);

  try {
    const user = await getDashboardUser();
    if (!user) return;

    const name = user.user_metadata?.full_name || 'User';

    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const avatarEl = document.getElementById('avatar');

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

    const tasks = [
      ['Profil', loadProfile],
      ['Produk', loadProducts],
      ['Pesanan', loadOrders]
    ];

    await Promise.all(tasks.map(async ([label, fn]) => {
      try {
        await Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout 12 detik')), 12000)
          )
        ]);
      } catch (err) {
        console.error(`Gagal memuat ${label}:`, err);
        toast(`${label} gagal dimuat: ${err.message}`, 'error');
      }
    }));

    console.log('✅ Proses dashboard selesai.');
  } catch (err) {
    console.error('Dashboard error:', err);
    toast('Gagal membuka dashboard: ' + err.message, 'error');
  } finally {
    clearTimeout(loadingTimer);
  }
})();
