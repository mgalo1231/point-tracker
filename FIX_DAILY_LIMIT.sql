-- =====================================================
-- 修复每日自我加分限制（5次/天）
-- =====================================================

-- 1. 先删除旧的触发器和函数
drop trigger if exists check_self_points_limit on points_history;
drop function if exists check_daily_self_points_limit();

-- 2. 重新创建限制函数
create or replace function check_daily_self_points_limit()
returns trigger as $$
declare
  today_count integer;
begin
  -- 只检查用户给自己加分的情况（amount > 0 且 user_id = created_by）
  if new.user_id = new.created_by and new.amount > 0 then
    -- 统计今天已经自我加分的次数
    select count(*) into today_count
    from points_history
    where user_id = new.user_id
      and created_by = new.user_id
      and amount > 0
      and created_at >= current_date
      and created_at < current_date + interval '1 day';
    
    -- 如果已经达到5次，拒绝插入
    if today_count >= 5 then
      raise exception '今天的自我加分次数已达上限（5次）';
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- 3. 重新创建触发器
create trigger check_self_points_limit
  before insert on points_history
  for each row
  execute function check_daily_self_points_limit();

-- 4. 测试查询：查看今天的自我加分次数
select 
  user_id,
  count(*) as today_self_points_count
from points_history
where created_by = user_id
  and amount > 0
  and created_at >= current_date
group by user_id;

