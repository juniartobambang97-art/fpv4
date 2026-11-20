let currentOrdersData = [];
let currentUserId = null;
let activeChatOrderId = null;
let chatRefreshInterval = null;

// ---------- PROFIL & PRODUK ----------
async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  currentUserId = user.id;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (data) {
    if (document.getElementById('bizName')) document.getElementById('bizName').value = data.biz_name || '';
    if (document.getElementById('bizAddress')) document.getElementById('bizAddress').value = data.biz_address || '';
    if (document.getElementById('bizMaps')) document.getElementById('bizMaps').value = data.biz_maps || '';
  }
}

async function saveProfile(btn) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return toast('Sesi berakhir', 'error');
  setLoading(btn, true, 'Menyimpan…');
  const { error } = await sb.from('profiles').upsert({
    id: user.id,
    biz_name: document.getElementById('bizName').value.trim(),
    biz_address: document.getElementById('bizAddress').value.trim(),
    biz_maps: document.getElementById('bizMaps').value.trim()
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
      if (uploadError) { setLoading(btn, false); return toast('❌ Gagal upload: ' + uploadError.message, 'error'); }
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

// ---------- PESANAN & ESCROW ----------
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

  if (error) { console.error('Error load orders:', error); box.innerHTML = '<div class="empty">Gagal memuat.</div>'; return; }

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
      'awaiting_payment': { text: 'Menunggu Pembayaran', class: 'status-pending' },
      'paid_escrow': { text: 'Dana Ditahan (Escrow)', class: 'status-approved' },
      'in_progress': { text: 'Sedang Dikerjakan', class: 'status-approved' },
      'completed': { text: 'Selesai & Dana Cair', class: 'status-approved' },
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
        <p style="font-size:11px; color:var(--muted); margin-top:8px;">💬 Klik untuk buka Chat</p>
      </div>
    `;
  }).join('');
}

// ---------- CHAT SYSTEM ----------
async function openChat(orderId) {
  activeChatOrderId = orderId;
  const order = currentOrdersData.find(o => o.id === orderId);
  if (!order) return;

  document.getElementById('chatOrderTitle').textContent = order.products?.name || 'Order';
  const statusMap = {
    'pending': 'Menunggu Konfirmasi', 'awaiting_payment': 'Menunggu Pembayaran',
    'paid_escrow': 'Dana Ditahan (Escrow)', 'in_progress': 'Sedang Dikerjakan',
    'completed': 'Selesai', 'cancelled': 'Dibatalkan'
  };
  document.getElementById('chatOrderStatus').textContent = statusMap[order.status] || order.status;
  document.getElementById('chatOrderStatus').className = 'status-badge ' + 
    (order.status === 'pending' || order.status === 'awaiting_payment' ? 'status-pending' : 
     order.status === 'cancelled' ? 'status-rejected' : 'status-approved');

  // Render progress bar
  renderEscrowProgress(order.status);

  openModal('chatModal');
  loadMessages(orderId);
  renderEscrowActions(order);

  if (chatRefreshInterval) clearInterval(chatRefreshInterval);
  chatRefreshInterval = setInterval(() => loadMessages(orderId), 3000);
}

function renderEscrowProgress(status) {
  const steps = [
    { key: 'pending', icon: '1', label: 'Deal' },
    { key: 'awaiting_payment', icon: '2', label: 'Invoice' },
    { key: 'paid_escrow', icon: '3', label: 'Escrow' },
    { key: 'in_progress', icon: '4', label: 'Produksi' },
    { key: 'completed', icon: '5', label: 'Selesai' }
  ];

  const statusOrder = ['pending', 'awaiting_payment', 'paid_escrow', 'in_progress', 'completed'];
  const currentIdx = statusOrder.indexOf(status);

  const box = document.getElementById('escrowProgress');
  if (!box) return;

  box.innerHTML = steps.map((s, i) => {
    let cls = '';
    if (i < currentIdx) cls = 'done';
    else if (i === currentIdx) cls = 'active';
    return `
      <div class="step ${cls}">
        <div class="step-icon">${cls === 'done' ? '✓' : s.icon}</div>
        <div class="step-label">${s.label}</div>
      </div>
    `;
  }).join('');
}

async function loadMessages(orderId) {
  const { data } = await sb.from('messages').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
  const box = document.getElementById('chatMessages');
  if (!box) return;

  if (!data || !data.length) {
    box.innerHTML = '<div style="text-align:center; color:var(--muted); font-size:13px; margin-top:20px;">Belum ada pesan. Mulai percakapan!</div>';
    return;
  }

  box.innerHTML = data.map(m => {
    const isSystem = m.message.startsWith('🔔 [SISTEM]');
    const isMe = m.sender_id === currentUserId;
    const time = new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    if (isSystem) {
      return `<div class="chat-bubble chat-system">${m.message.replace('🔔 [SISTEM] ', '')} <span class="chat-time" style="text-align:center">${time}</span></div>`;
    }

    let photoHtml = '';
    if (m.photo_url) {
      photoHtml = `<img src="${m.photo_url}" class="chat-photo" onclick="window.open('${m.photo_url}', '_blank')">`;
    }

    return `
      <div class="chat-bubble ${isMe ? 'chat-me' : 'chat-other'}">
        ${m.message}
        ${photoHtml}
        <span class="chat-time">${time}</span>
      </div>
    `;
  }).join('');
  
  box.scrollTop = box.scrollHeight;
}

// Handle foto di chat
const chatPhotoInput = document.getElementById('chatPhoto');
let pendingChatPhoto = null;
if (chatPhotoInput) {
  chatPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return toast('Login dulu', 'error');

    toast('📤 Mengupload foto...', 'success');
    const fileName = `chat/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await sb.storage.from('chat-photos').upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      toast('❌ Gagal upload foto', 'error');
      pendingChatPhoto = null;
      return;
    }

    const { data: { publicUrl } } = sb.storage.from('chat-photos').getPublicUrl(fileName);
    pendingChatPhoto = publicUrl;
    toast('✅ Foto siap dikirim! Ketik pesan lalu kirim.', 'success');
    chatPhotoInput.value = ''; // Reset
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
    btn.disabled = true;
    btn.textContent = '...';

    const { error } = await sb.from('messages').insert({
      order_id: activeChatOrderId,
      sender_id: currentUserId,
      message: msg || '📸 [Foto Progress]',
      photo_url: pendingChatPhoto
    });
    
    btn.disabled = false;
    btn.textContent = 'Kirim';
    
    if (error) toast('❌ Gagal kirim', 'error');
    else {
      input.value = '';
      pendingChatPhoto = null;
      loadMessages(activeChatOrderId);
    }
  });
}

// ---------- ESCROW ACTIONS ----------
function renderEscrowActions(order) {
  const box = document.getElementById('escrowActions');
  const isSeller = order.seller_id === currentUserId;
  let html = '';

  if (order.status === 'pending' && isSeller) {
    html = `<button class="btn btn-sm" onclick="changeOrderStatus('${order.id}', 'awaiting_payment')">✅ Setujui & Kirim Invoice</button>
            <button class="btn btn-sm btn-danger" onclick="changeOrderStatus('${order.id}', 'cancelled')">❌ Tolak</button>`;
  } else if (order.status === 'awaiting_payment' && !isSeller) {
    html = `<button class="btn btn-sm" style="grid-column: 1/-1; background:#16a34a" onclick="changeOrderStatus('${order.id}', 'paid_escrow')">💰 Bayar ke Escrow</button>`;
  } else if (order.status === 'paid_escrow' && isSeller) {
    html = `<button class="btn btn-sm" style="grid-column: 1/-1;" onclick="changeOrderStatus('${order.id}', 'in_progress')">🔨 Mulai Produksi</button>`;
  } else if (order.status === 'in_progress') {
    html = `<button class="btn btn-sm" style="grid-column: 1/-1; background:#16a34a" onclick="changeOrderStatus('${order.id}', 'completed')">🎉 Selesai & Cairkan Dana</button>`;
  } else if (order.status === 'completed') {
    html = `<p style="font-size:12px; color:var(--muted); grid-column: 1/-1; text-align:center;">✅ Transaksi selesai. Dana telah dicairkan.</p>`;
  } else if (order.status === 'cancelled') {
    html = `<p style="font-size:12px; color:var(--muted); grid-column: 1/-1; text-align:center;">❌ Transaksi dibatalkan.</p>`;
  }

  box.innerHTML = html;
}

async function changeOrderStatus(orderId, newStatus) {
  const confirmMsg = {
    'awaiting_payment': 'Setujui pesanan dan kirim invoice ke pembeli?',
    'paid_escrow': 'Konfirmasi transfer dana ke Escrow?',
    'in_progress': 'Mulai produksi pesanan ini?',
    'completed': 'Konfirmasi selesai & cairkan dana ke penjual?',
    'cancelled': 'Batalkan pesanan?'
  };
  
  if (!confirm(confirmMsg[newStatus])) return;

  const { error } = await sb.from('orders').update({ status: newStatus }).eq('id', orderId);
  if (error) return toast('❌ Gagal: ' + error.message, 'error');

  toast('✅ Status diperbarui!');
  
  const statusText = {
    'awaiting_payment': 'Pesanan disetujui. Silakan lakukan pembayaran ke Escrow.',
    'paid_escrow': 'Pembayaran diterima. Dana ditahan di Escrow. Silakan mulai produksi.',
    'in_progress': 'Produksi dimulai. Kirim foto progress di chat!',
    'completed': 'Pekerjaan selesai. Dana dicairkan ke penjual.',
    'cancelled': 'Pesanan dibatalkan.'
  };
  
  await sb.from('messages').insert({
    order_id: orderId, sender_id: currentUserId,
    message: `🔔 [SISTEM] ${statusText[newStatus]}`
  });

  loadOrders();
  if (activeChatOrderId === orderId) {
    const order = currentOrdersData.find(o => o.id === orderId);
    if (order) {
      renderEscrowActions(order);
      renderEscrowProgress(order.status);
      document.getElementById('chatOrderStatus').textContent = {
        'pending': 'Menunggu Konfirmasi', 'awaiting_payment': 'Menunggu Pembayaran',
        'paid_escrow': 'Dana Ditahan (Escrow)', 'in_progress': 'Sedang Dikerjakan',
        'completed': 'Selesai', 'cancelled': 'Dibatalkan'
      }[order.status] || order.status;
    }
    loadMessages(orderId);
  }
}
