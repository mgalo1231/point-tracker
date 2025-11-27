-- =====================================================
-- 重新创建 exchanges 表（完整版本）
-- =====================================================

-- 1. 先删除旧表（如果需要保留数据，请先备份！）
drop table if exists exchanges cascade;

-- 2. 创建新的 exchanges 表，包含所有必需字段
create table exchanges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  reward_id uuid references rewards(id) on delete set null,
  reward_name text not null,
  points_cost integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  admin_note text,
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- 3. 启用 RLS
alter table exchanges enable row level security;

-- 4. 删除旧策略（如果存在）
drop policy if exists "Users can view own exchanges" on exchanges;
drop policy if exists "Users can insert own exchanges" on exchanges;
drop policy if exists "Admins can view all exchanges" on exchanges;
drop policy if exists "Admins can update exchanges" on exchanges;

-- 5. 创建新的 RLS 策略
-- 用户可以查看自己的兑换记录
create policy "Users can view own exchanges"
  on exchanges for select
  using (auth.uid() = user_id);

-- 用户可以创建自己的兑换申请
create policy "Users can insert own exchanges"
  on exchanges for insert
  with check (auth.uid() = user_id);

-- 管理员可以查看所有兑换记录
create policy "Admins can view all exchanges"
  on exchanges for select
  using (auth.uid() in (select id from profiles where is_admin = true));

-- 管理员可以更新兑换状态
create policy "Admins can update exchanges"
  on exchanges for update
  using (auth.uid() in (select id from profiles where is_admin = true));

-- 6. 创建索引以提高查询性能
create index if not exists exchanges_user_id_idx on exchanges(user_id);
create index if not exists exchanges_status_idx on exchanges(status);
create index if not exists exchanges_created_at_idx on exchanges(created_at desc);

-- 7. 查看表结构确认
select column_name, data_type, is_nullable, column_default
from information_schema.columns 
where table_name = 'exchanges' 
order by ordinal_position;

