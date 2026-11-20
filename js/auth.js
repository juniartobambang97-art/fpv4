// ============================================
// AUTH HANDLER
// ============================================

async function checkSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// REGISTER
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullname = document.getElementById('fullname').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('msg');

    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { full_name: fullname } }
    });

    if (error) {
      msg.textContent = '❌ ' + error.message;
    } else {
      msg.style.color = '#16a34a';
      msg.textContent = '✅ Daftar berhasil! Cek email untuk verifikasi, lalu login.';
      setTimeout(() => location.href = 'login.html', 2000);
    }
  });
}

// LOGIN
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('msg');

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      msg.textContent = '❌ ' + error.message;
    } else {
      msg.style.color = '#16a34a';
      msg.textContent = '✅ Login berhasil! Redirecting...';
      setTimeout(() => location.href = 'dashboard.html', 800);
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

// DASHBOARD GUARD
(async () => {
  if (location.pathname.includes('dashboard.html')) {
    const session = await checkSession();
    if (!session) {
      alert('Silakan login dulu!');
      location.href = 'login.html';
      return;
    }
    document.getElementById('userName').textContent =
      session.user.user_metadata?.full_name || 'User';
    document.getElementById('userEmail').textContent = session.user.email;
    loadProfile();
    loadProducts();
  }
})();
