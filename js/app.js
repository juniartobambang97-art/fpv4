// ============================================
// APP LOGIC (Profile + Product)
// ============================================

async function saveProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return alert('Login dulu!');

  const biz_name = document.getElementById('bizName').value;
  const biz_address = document.getElementById('bizAddress').value;
  const biz_maps = document.getElementById('bizMaps').value;

  const { error } = await sb.from('profiles').upsert({
    id: user.id,
    biz_name, biz_address, biz_maps
  });

  if (error) alert('Gagal simpan: ' + error.message);
  else alert('✅ Profil tersimpan!');
}

async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data } = await sb.from('profiles')
    .select('*').eq('id', user.id).single();

  if (data) {
    document.getElementById('bizName').value = data.biz_name || '';
    document.getElementById('bizAddress').value = data.biz_address || '';
    document.getElementById('bizMaps').value = data.biz_maps || '';
  }
}

async function createProduct() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return alert('Login dulu!');

  const name = prompt('Nama produk:');
  if (!name) return;
  const price = prompt('Harga per pcs:');
  const min = prompt('Minimum order (pcs):');

  const { error } = await sb.from('products').insert({
    owner_id: user.id,
    name, price: Number(price), min_order: Number(min)
  });

  if (error) alert('Gagal: ' + error.message);
  else loadProducts();
}

async function loadProducts() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  const { data } = await sb.from('products')
    .select('*').eq('owner_id', user.id);

  const container = document.getElementById('products');
  if (!container) return;
  container.innerHTML = '';

  (data || []).forEach(p => {
    const div = document.createElement('div');
    div.className = 'product';
    div.innerHTML = `
      <h4>${p.name}</h4>
      <p>Harga: Rp${Number(p.price).toLocaleString('id-ID')} / pcs</p>
      <p>Min: ${p.min_order} pcs</p>
    `;
    container.appendChild(div);
  });
}
