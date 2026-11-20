-- ============================================
-- SUPABASE SQL SCHEMA
-- ============================================
-- Jalankan di Supabase Dashboard > SQL Editor

-- 1. Tabel profiles (auto sync dengan auth.users)
create table if not exists public.profiles (
  id uuid references auth.users primary key,
  biz_name text,
  biz_address text,
  biz_maps text,
  created_at timestamp default now()
);

-- 2. Tabel products
create table if not exists public.products (
  id bigserial primary key,
  owner_id uuid references auth.users not null,
  name text not null,
  price numeric not null,
  min_order integer default 100,
  created_at timestamp default now()
);

-- 3. Tabel orders (bonus)
create table if not exists public.orders (
  id bigserial primary key,
  buyer_id uuid references auth.users,
  product_id bigint references public.products,
  qty integer,
  status text default 'pending',
  created_at timestamp default now()
);

-- 4. Enable RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- 5. Policy: profiles - user hanya bisa edit profil sendiri
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can upsert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 6. Policy: products - user bisa lihat semua, tapi hanya bisa create/edit milik sendiri
create policy "Anyone can view products"
  on public.products for select
  using (true);

create policy "Users can create own products"
  on public.products for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own products"
  on public.products for update
  using (auth.uid() = owner_id);

-- 7. Auto-create profile saat user baru register
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, biz_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
