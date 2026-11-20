# Setup Supabase untuk FPV4

## 1. Buat Project Supabase
- Buka https://supabase.com
- Sign up / Login
- Klik "New Project"
- Isi nama project, password DB, region (pilih Singapore agar cepat)
- Tunggu sampai project ready (~2 menit)

## 2. Copy Credentials
- Buka project kamu
- Settings (gear icon) > API
- Copy **Project URL** dan **anon public key**
- Paste di `js/supabase.js`

## 3. Jalankan SQL Schema
- Buka menu "SQL Editor" di sidebar
- Copy isi file `supabase/schema.sql`
- Paste & klik "Run"
- Pastikan tidak ada error

## 4. Matikan Email Confirmation (Opsional, untuk testing)
- Authentication > Providers > Email
- Matikan "Confirm email" (supaya langsung bisa login setelah register)

## 5. Test
- Buka `index.html` di browser
- Register akun baru
- Login
- Cek dashboard
- Cek tabel `profiles` & `products` di Supabase > Table Editor

## Catatan
- File ini pure frontend (HTML+JS), bisa dibuka langsung di browser Termux
- Untuk production, host di Netlify/Vercel/GitHub Pages
- Semua data tersimpan di Supabase (PostgreSQL)
