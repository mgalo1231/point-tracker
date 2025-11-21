-- =====================================================
-- 安全更新：修复 RLS 策略，允许用户自我加分
-- =====================================================

-- 1. 删除旧的 insert 策略
drop policy if exists "Admins can insert history" on points_history;

-- 2. 创建新的策略：管理员可以给任何人加/扣分
create policy "Admins can insert any history" 
  on points_history for insert 
  with check ( 
    auth.uid() in (select id from profiles where is_admin = true)
  );

-- 3. 允许普通用户给自己加分（仅限正数，且需要是合理范围）
create policy "Users can add points to themselves" 
  on points_history for insert 
  with check ( 
    auth.uid() = user_id 
    and auth.uid() = created_by 
    and amount > 0 
    and amount <= 100  -- 单次自我加分上限100分，防止作弊
  );

-- 4. 确保 profiles 表的 RLS 策略正确
-- 检查是否有 "Enable read access for all users" 策略
-- 如果没有，需要创建（否则管理员看不到其他用户）
create policy if not exists "Enable read access for all users" 
  on profiles for select 
  using (true);

-- 5. 允许用户更新自己的 profile（昵称、头像等）
create policy if not exists "Users can update own profile" 
  on profiles for update 
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6. 允许用户插入自己的 profile（注册时）
create policy if not exists "Users can insert own profile" 
  on profiles for insert 
  with check (auth.uid() = id);

-- =====================================================
-- 额外安全措施：限制每日自我加分次数
-- =====================================================
-- 创建一个函数来检查今天已经自我加分的次数
create or replace function check_daily_self_points_limit()
returns trigger as $$
declare
  today_count integer;
begin
  -- 只检查用户给自己加分的情况
  if new.user_id = new.created_by then
    select count(*) into today_count
    from points_history
    where user_id = new.user_id
      and created_by = new.user_id
      and amount > 0
      and created_at >= current_date;
    
    -- 限制每天最多自我加分5次
    if today_count >= 5 then
      raise exception '今天的自我加分次数已达上限（5次）';
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- 创建触发器
drop trigger if exists check_self_points_limit on points_history;
create trigger check_self_points_limit
  before insert on points_history
  for each row
  execute function check_daily_self_points_limit();

