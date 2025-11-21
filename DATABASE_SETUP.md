# 数据库设置 (Database Setup)

由于我们无法直接访问你的 Supabase 控制台，请你登录 [Supabase Dashboard](https://supabase.com/dashboard) 并进入 SQL Editor 运行以下 SQL 语句来创建所需的表结构。

## 1. 创建 Profiles 表 (用户信息)

用于存储用户的额外信息（如是否为管理员、当前积分）。

```sql
-- 创建 profiles 表
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  is_admin boolean default false,
  points integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 设置 RLS (Row Level Security) 策略
alter table profiles enable row level security;

-- 允许用户查看自己的 profile
create policy "Users can view own profile" 
  on profiles for select 
  using ( auth.uid() = id );

-- 允许管理员查看所有 profile
create policy "Admins can view all profiles" 
  on profiles for select 
  using ( 
    auth.uid() in (select id from profiles where is_admin = true)
  );

-- 允许管理员更新所有 profile (加分/扣分)
create policy "Admins can update all profiles" 
  on profiles for update 
  using ( 
    auth.uid() in (select id from profiles where is_admin = true)
  );

-- 创建一个触发器，当新用户注册时自动在 profiles 表中创建记录
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, is_admin, points)
  values (new.id, new.email, false, 0);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 2. 创建 Points History 表 (积分历史)

用于记录每一次积分变动的原因（如“洗碗”、“兑换游戏时间”）。

```sql
create table if not exists points_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade,
  amount integer not null, -- 正数表示加分，负数表示扣分
  reason text not null,    -- 变动原因
  created_by uuid references profiles(id), -- 操作人 (通常是管理员)
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table points_history enable row level security;

-- 用户可以查看自己的积分历史
create policy "Users can view own history" 
  on points_history for select 
  using ( auth.uid() = user_id );

-- 管理员可以查看所有历史
create policy "Admins can view all history" 
  on points_history for select 
  using ( 
    auth.uid() in (select id from profiles where is_admin = true)
  );

-- 只有管理员可以插入历史记录
create policy "Admins can insert history" 
  on points_history for insert 
  with check ( 
    auth.uid() in (select id from profiles where is_admin = true)
  );
```

## 3. 设置初始管理员

手动将你自己的账号设置为管理员。请在 Supabase 的 Table Editor 中找到 `profiles` 表，将你账号的 `is_admin` 字段改为 `TRUE`。

