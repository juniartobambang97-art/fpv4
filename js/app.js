// ---------- PROFIL ----------
async function saveProfile(btn) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return toast('Sesi berakhir, login ulang ya', 'error');

  setLoading(btn, true, 'Menyimpan…');
  const { error } = await sb.from('profiles').upsert({
    id: user.id,
    biz_name: document.getElementById('bizName').value.trim(),
    biz_address: document.getElementById('bizAddress').value.trim(),
    biz_maps: document.getElementById('bizMaps').value.trim()
  });
  setLoading(btn, false);

  error ? toast('❌ ' + error.message, 'error')
        : toast('✅ Profil tersimpan!');
}

async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data } = await sb.from('profiles')
    .select('*').eq('id', user.id).maybeSingle();
  if (data) {
    document.getElementById('bizName').value = data.biz_name || '';
    document.getElementById('bizAddress').value = data.biz_address || '';
    document.getElementById('bizMaps').value = data.biz_maps || '';
  }
}

// ---------- PRODUK ----------
const productForm = document.getElementById('productForm');
if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const btn = productForm.querySelector('[type=submit]');
    setLoading(btn, true);

    const { error } = await sb.from('products').insert({
      owner_id: user.id,
      name: document.getElementById('pName').value.trim(),
      price: Number(document.getElementById('pPrice').value),
      min_order: Number(document.getElementById('pMin').value)
    });
    setLoading(btn, false);

    if (error) return toast('❌ ' + error.message, 'error');

    toast('✅ Produk ditambahkan!');
    productForm.reset();
    document.getElementById('pMin').value = 100;
    closeModal('productModal');
    loadProducts();
  });
}

async function deleteProduct(id, btn) {
  if (!confirm('Hapus produk ini?')) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) toast('❌ ' + error.message, 'error');
  else {
    toast('🗑️ Produk dihapus.');
    loadProducts();
  }
}

async function loadProducts() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data } = await sb.from('products')
    .select('*').eq('owner_id', user.id).order('created_at', { ascending: false });

  const box = document.getElementById('products');
  const stat = document.getElementById('statProducts');
  if (!box) return;

  stat.textContent = (data || []).length;

  if (!data || !data.length) {
    box.innerHTML = '<div class="empty" style="grid-column:1/-1"><span>📦</span>Belum ada produk. Klik "+ Tambah Produk".</div>';
    return;
  }

  box.innerHTML = data.map(p => `
    <div class="product">
      <h4>${p.name}</h4>
      <div class="price">Rp${Number(p.price).toLocaleString('id-ID')}</div>
      <span class="badge">Min. ${p.min_order} pcs</span>
      <button class="del" onclick="deleteProduct(${p.id})">🗑️ Hapus</button>
    </div>
  `).join('');
}
