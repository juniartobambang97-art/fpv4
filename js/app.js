let currentOrdersData = [];
let currentUserId = null;
let activeChatOrderId = null;
let chatRefreshInterval = null;
let pendingChatPhoto = null;

// ---------- PROFIL & PRODUK ----------
async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  currentUserId = user.id;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (data) {
    if (document.getElementById('bizName')) document.getElementById('bizName').value = data.biz_name || '';
    if (document.getElementById('bizAddress')) document.getElementById('bizAddress').value = data.biz_address || '';
  }
}

async function saveProfile(btn) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return toast('Sesi berakhir', 'error');
  setLoading(btn, true, 'Menyimpan…');
  const { error } = await sb.from('profiles').upsert({
    id: user.id,
    biz_name: document.getElementById('bizName').value.trim(),
    biz_address: document.getElementById('bizAddress').value.trim()
  });
  setLoading(btn, false);
  error ? toast('❌ ' + error.message, 'error') : toast('✅ Profil tersimpan!');
}

async function loadProducts() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const box = document.getElementById('products');
  if (!box) return;
  const { data } = await sb.from('products').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
  if (document.getElementById('statProducts')) document.getElementById('statProducts').textContent = (data || []).length;
  if (!data || !data.length) { box.innerHTML = '<div class="empty" style="grid-column:1/-1"><span>📦</span>Belum ada produk.</div>'; return; }
  box.innerHTML = data.map(p => `
    <div class="product">
      <img src="${p.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}" class="product-img" onerror="this.src='https://via.placeholder.com/400x300?text=Error'">
      <div style="display:flex; justify-content:space-between; align-items:start; gap:8px;">
        <h4 style="margin:0; flex:1;">${p.name}</h4>
        <span class="cat-badge">${p.category || 'Lainnya'}</span>
      </div>
      <div class="price">Rp${Number(p.price).toLocaleString('id-ID')}</div>
      <span class="badge">Min. ${p.min_order} pcs</span>
      <button class="del" onclick="deleteProduct(${p.id}, '${p.image_url || ''}')">🗑️ Hapus</button>
    </div>
  `).join('');
}

const productForm = document.getElementById('productForm');
if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return toast('Sesi berakhir', 'error');
    const btn = productForm.querySelector('[type=submit]');
    const file = document.getElementById('pImage').files[0];
    setLoading(btn, true, 'Mengupload...');
    let imageUrl = '';
    if (file) {
      const fileName = `${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await sb.storage.from('product-images').upload(fileName, file, { upsert: true });
      if (uploadError) { setLoading(btn, false); return toast('❌ Gagal upload', 'error'); }
      const { data: { publicUrl } } = sb.storage.from('product-images').getPublicUrl(fileName);
      imageUrl = publicUrl;
    }
    setLoading(btn, true, 'Menyimpan...');
    const { error } = await sb.from('products').insert({
      owner_id: user.id, name: document.getElementById('pName').value.trim(),
      category: document.getElementById('pCategory').value, price: Number(document.getElementById('pPrice').value),
      min_order: Number(document.getElementById('pMin').value), image_url: imageUrl
    });
    setLoading(btn, false);
    if (error) return toast('❌ ' + error.message, 'error');
    toast('✅ Produk ditambahkan!');
    productForm.reset(); document.getElementById('pMin').value = 100;
    closeModal('productModal'); loadProducts();
  });
}

async function deleteProduct(id, imageUrl) {
  if (!confirm('Yakin hapus?')) return;
  if (imageUrl && imageUrl.includes('product-images')) {
    const path = imageUrl.split('/product-images/')[1];
    if (path) await sb.storage.from('product-images').remove([path]);
  }
  await sb.from('products').delete().eq('id', id);
  toast('🗑️ Produk dihapus.'); loadProducts();
}

// ---------- PESANAN & CHAT ----------
async function loadOrders() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  currentUserId = user.id;
  const box = document.getElementById('ordersList');
  if (!box) return;

  const { data, error } = await sb.from('orders')
    .select('*, products(name, price)')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) { box.innerHTML = '<div class="empty">Gagal memuat.</div>'; return; }

  currentOrdersData = data || [];
  const activeCount = currentOrdersData.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
  if (document.getElementById('statOrders')) document.getElementById('statOrders').textContent = activeCount;

  if (!currentOrdersData.length) {
    box.innerHTML = '<div class="empty"><span>📭</span>Belum ada pesanan.</div>';
    return;
  }

  box.innerHTML = currentOrdersData.map(o => {
    const isSeller = o.seller_id === user.id;
    const otherParty = isSeller ? o.buyer_name : 'Pembeli';
    const statusMap = {
      'pending': { text: 'Menunggu Konfirmasi', class: 'status-pending' },
      'awaiting_material_payment': { text: 'Menunggu Bayar ke Supplier', class: 'status-pending' },
      'material_paid': { text: 'Bahan Terbayar - Produksi', class: 'status-approved' },
      'in_progress': { text: 'Sedang Produksi', class: 'status-approved' },
      'completed': { text: 'Selesai', class: 'status-approved' },
      'cancelled': { text: 'Dibatalkan', class: 'status-rejected' }
    };
    const st = statusMap[o.status] || { text: o.status, class: '' };

    return `
      <div class="order-item" style="cursor:pointer" onclick="openChat('${o.id}')">
        <div class="order-header">
          <strong>${o.products?.name || 'Produk'}</strong>
          <span class="status-badge ${st.class}">${st.text}</span>
        </div>
        <p style="font-size:13px; margin:4px 0;"><strong>${isSeller ? 'Pembeli' : 'Penjual'}:</strong> ${otherParty}</p>
        <p style="font-size:13px; margin:4px 0;"><strong>Total:</strong> Rp${Number(o.total_price).toLocaleString('id-ID')}</p>
        <p style="font-size:11px; color:var(--muted); margin-top:8px;">💬 Klik untuk Chat & Update</p>
      </div>
    `;
  }).join('');
}

async function openChat(orderId) {
  activeChatOrderId = orderId;
  const order = currentOrdersData.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('chatOrderTitle').textContent = order.products?.name || 'Order';
  const statusMap = {
    'pending': 'Menunggu Konfirmasi', 'awaiting_material_payment': 'Menunggu Bayar ke Supplier',
    'material_paid': 'Bahan Terbayar', 'in_progress': 'Sedang Produksi',
    'completed': 'Selesai', 'cancelled': 'Dibatalkan'
  };
  document.getElementById('chatOrderStatus').textContent = statusMap[order.status] || order.status;
  
  openModal('chatModal');
  loadMessages(orderId);
  renderActions(order);

  if (chatRefreshInterval) clearInterval(chatRefreshInterval);
  chatRefreshInterval = setInterval(() => { loadMessages(orderId); loadOrders(); }, 3000);
}

async function loadMessages(orderId) {
  const { data } = await sb.from('messages').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
  const box = document.getElementById('chatMessages');
  if (!box) return;

  if (!data || !data.length) {
    box.innerHTML = '<div style="text-align:center; color:var(--muted); font-size:13px; margin-top:20px;">Belum ada pesan.</div>';
    return;
  }

  box.innerHTML = data.map(m => {
    const isSystem = m.message.startsWith('🔔 [SISTEM]');
    const isQris = m.message.startsWith('🏭 [QRIS SUPPLIER]');
    const isMe = m.sender_id === currentUserId;
    const time = new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    if (isSystem) return `<div class="chat-bubble chat-system">${m.message.replace('🔔 [SISTEM] ', '')} <span class="chat-time" style="text-align:center">${time}</span></div>`;

    let photoHtml = '';
    if (m.photo_url) {
      const label = isQris ? '🏭 <strong>QRIS Toko Bahan:</strong><br>' : '📸 <strong>Foto:</strong><br>';
      photoHtml = `<div style="margin-top:6px">${label}<img src="${m.photo_url}" class="chat-photo" onclick="window.open('${m.photo_url}', '_blank')"></div>`;
    }

    return `<div class="chat-bubble ${isMe ? 'chat-me' : 'chat-other'}">${m.message}${photoHtml}<span class="chat-time">${time}</span></div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

// Upload Foto Chat Biasa
const chatPhotoInput = document.getElementById('chatPhoto');
if (chatPhotoInput) {
  chatPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return toast('Login dulu', 'error');
    toast('📤 Mengupload...', 'success');
    const fileName = `chat/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await sb.storage.from('chat-photos').upload(fileName, file, { upsert: true });
    if (error) { toast('❌ Gagal', 'error'); pendingChatPhoto = null; return; }
    const { data: { publicUrl } } = sb.storage.from('chat-photos').getPublicUrl(fileName);
    pendingChatPhoto = publicUrl;
    toast('✅ Foto siap!', 'success');
    chatPhotoInput.value = '';
  });
}

const chatForm = document.getElementById('chatForm');
if (chatForm) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if ((!msg && !pendingChatPhoto) || !activeChatOrderId || !currentUserId) return;

    const btn = chatForm.querySelector('button');
    btn.disabled = true; btn.textContent = '...';

    const { error } = await sb.from('messages').insert({
      order_id: activeChatOrderId, sender_id: currentUserId,
      message: msg || '📸 [Foto]', photo_url: pendingChatPhoto
    });
    btn.disabled = false; btn.textContent = 'Kirim';
    if (error) toast('❌ Gagal kirim', 'error');
    else { input.value = ''; pendingChatPhoto = null; loadMessages(activeChatOrderId); }
  });
}

// ---------- FITUR BARU: INPUT QRIS SUPPLIER ----------
const supplierQrisForm = document.getElementById('supplierQrisForm');
if (supplierQrisForm) {
  supplierQrisForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supName = document.getElementById('supName').value.trim();
    const supAmount = document.getElementById('supAmount').value;
    const qrisFile = document.getElementById('supQris').files[0];
    
    if (!qrisFile) return toast('Upload foto QRIS dulu!', 'error');

    const btn = supplierQrisForm.querySelector('[type=submit]');
    setLoading(btn, true, 'Mengupload QRIS...');

    const { data: { user } } = await sb.auth.getUser();
    const fileName = `supplier-qris/${user.id}/${Date.now()}.${qrisFile.name.split('.').pop()}`;
    const { error: uploadError } = await sb.storage.from('chat-photos').upload(fileName, qrisFile, { upsert: true });
    
    if (uploadError) { setLoading(btn, false); return toast('❌ Gagal upload QRIS', 'error'); }
    const { data: { publicUrl } } = sb.storage.from('chat-photos').getPublicUrl(fileName);

    // Update order dengan data supplier
    const { error: dbError } = await sb.from('orders').update({
      supplier_name: supName,
      supplier_amount: Number(supAmount),
      supplier_qris_url: publicUrl,
      status: 'awaiting_material_payment'
    }).eq('id', activeChatOrderId);

    if (dbError) { setLoading(btn, false); return toast('❌ Gagal simpan', 'error'); }

    // Kirim pesan sistem ke chat
    await sb.from('messages').insert({
      order_id: activeChatOrderId, sender_id: currentUserId,
      message: `🏭 [QRIS SUPPLIER] Silakan bayar Rp${Number(supAmount).toLocaleString('id-ID')} ke ${supName}. Scan QRIS di bawah ini untuk menjamin produksi!`,
      photo_url: publicUrl
    });

    setLoading(btn, false);
    toast('✅ QRIS Supplier terkirim ke pembeli!', 'success');
    closeModal('supplierQrisModal');
    supplierQrisForm.reset();
    loadOrders();
    loadMessages(activeChatOrderId);
    const order = currentOrdersData.find(o => o.id === activeChatOrderId);
    if (order) renderActions(order);
  });
}

// Upload Bukti Bayar ke Supplier (Oleh Pembeli)
const paymentProofInput = document.getElementById('paymentProofInput');
if (paymentProofInput) {
  paymentProofInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChatOrderId) return;

    toast('📤 Mengupload bukti bayar ke supplier...', 'success');
    const { data: { user } } = await sb.auth.getUser();
    const fileName = `payment-proofs/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await sb.storage.from('chat-photos').upload(fileName, file, { upsert: true });
    
    if (uploadError) return toast('❌ Gagal upload bukti', 'error');
    const { data: { publicUrl } } = sb.storage.from('chat-photos').getPublicUrl(fileName);

    await sb.from('messages').insert({
      order_id: activeChatOrderId, sender_id: currentUserId,
      message: '🔔 [SISTEM] Pembeli telah mengunggah bukti transfer ke Toko Bahan.',
      photo_url: publicUrl
    });

    toast('✅ Bukti transfer terkirim! Menunggu konfirmasi konveksi.', 'success');
    loadMessages(activeChatOrderId);
    paymentProofInput.value = '';
  });
}

// ---------- ACTIONS ----------
function renderActions(order) {
  const box = document.getElementById('escrowActions');
  const isSeller = order.seller_id === currentUserId;
  let html = '';

  if (order.status === 'pending' && isSeller) {
    html = `<button class="btn btn-sm" onclick="changeStatus('${order.id}', 'pending_confirm')">✅ Setujui Pesanan</button>
            <button class="btn btn-sm btn-danger" onclick="changeStatus('${order.id}', 'cancelled')">❌ Tolak</button>`;
  } 
  else if (order.status === 'pending_confirm' && isSeller) {
    html = `<button class="btn btn-sm" style="grid-column: 1/-1; background:#2563eb" onclick="openModal('supplierQrisModal')">🏭 Ajukan Bayar ke Toko Bahan</button>`;
  }
  else if (order.status === 'awaiting_material_payment' && !isSeller) {
    html = `<label for="paymentProofInput" class="btn btn-sm" style="grid-column: 1/-1; background:#16a34a; cursor:pointer; text-align:center;">💳 Saya Sudah Bayar ke Supplier (Upload Bukti)</label>`;
  } 
  else if (order.status === 'awaiting_material_payment' && isSeller) {
    if (order.payment_proof_url) { // Asumsi kita pakai kolom yang sama atau cek di chat
       html = `<button class="btn btn-sm" style="grid-column: 1/-1; background:#16a34a" onclick="changeStatus('${order.id}', 'material_paid')">✅ Konfirmasi Bahan Sudah Dibeli</button>`;
    } else {
      html = `<p style="font-size:12px; color:var(--muted); grid-column: 1/-1; text-align:center;">⏳ Menunggu pembeli bayar ke QRIS Supplier...</p>
              <a href="${order.supplier_qris_url}" target="_blank" class="btn btn-sm btn-ghost" style="grid-column: 1/-1;">👁️ Lihat QRIS yang dikirim</a>`;
    }
  } 
  else if (order.status === 'material_paid' && isSeller) {
    html = `<button class="btn btn-sm" style="grid-column: 1/-1;" onclick="changeStatus('${order.id}', 'in_progress')">🔨 Mulai Produksi</button>`;
  } 
  else if (order.status === 'in_progress' && isSeller) {
    html = `<button class="btn btn-sm" style="grid-column: 1/-1; background:#16a34a" onclick="changeStatus('${order.id}', 'completed')">🎉 Selesai & Kirim Barang</button>`;
  } 
  else if (order.status === 'completed') {
    html = `<p style="font-size:12px; color:var(--muted); grid-column: 1/-1; text-align:center;">✅ Transaksi selesai. Terima kasih!</p>`;
  } 
  else if (order.status === 'cancelled') {
    html = `<p style="font-size:12px; color:var(--muted); grid-column: 1/-1; text-align:center;">❌ Transaksi dibatalkan.</p>`;
  }

  box.innerHTML = html;
}

async function changeStatus(orderId, newStatus) {
  const confirmMsg = {
    'pending_confirm': 'Setujui pesanan ini?',
    'material_paid': 'Konfirmasi bahwa pembeli sudah bayar ke supplier dan bahan sudah dibeli?',
    'in_progress': 'Mulai produksi?',
    'completed': 'Tandai pesanan selesai?',
    'cancelled': 'Batalkan pesanan?'
  };
  if (!confirm(confirmMsg[newStatus])) return;

  const { error } = await sb.from('orders').update({ status: newStatus }).eq('id', orderId);
  if (error) return toast('❌ Gagal: ' + error.message, 'error');

  const statusText = {
    'pending_confirm': 'Pesanan disetujui. Konveksi akan mengirimkan QRIS Toko Bahan.',
    'material_paid': 'Pembayaran ke supplier dikonfirmasi. Produksi resmi dimulai!',
    'in_progress': 'Produksi dimulai. Update progress di chat.',
    'completed': 'Pesanan selesai. Barang akan segera dikirim.',
    'cancelled': 'Pesanan dibatalkan.'
  };
  
  await sb.from('messages').insert({
    order_id: orderId, sender_id: currentUserId,
    message: `🔔 [SISTEM] ${statusText[newStatus]}`
  });

  toast('✅ Status diperbarui!');
  loadOrders();
  if (activeChatOrderId === orderId) {
    const order = currentOrdersData.find(o => o.id === orderId);
    if (order) renderActions(order);
    loadMessages(orderId);
  }
}
