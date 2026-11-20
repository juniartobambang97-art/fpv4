// Toast notification
function toast(msg, type = 'success') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => {
    t.classList.add('hide');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// Modal
function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

// Tutup modal kalau klik area gelap
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('overlay')) e.target.classList.remove('show');
});

// Password show/hide toggle
document.querySelectorAll('.pw-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = btn.parentElement.querySelector('input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  });
});

// Loading state untuk tombol submit
function setLoading(btn, on, text) {
  if (on) {
    btn.dataset.old = btn.textContent;
    btn.disabled = true;
    btn.textContent = text || 'Memproses…';
  } else {
    btn.disabled = false;
    btn.textContent = btn.dataset.old || btn.textContent;
  }
}
