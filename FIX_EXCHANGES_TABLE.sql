-- =====================================================
-- 修复 exchanges 表：添加缺失的字段
-- =====================================================

-- 1. 添加 points_cost 字段（如果不存在）
alter table exchanges 
add column if not exists points_cost integer not null default 0;

-- 2. 添加 reward_name 字段（如果不存在）
alter table exchanges 
add column if not exists reward_name text not null default '';

-- 3. 如果有旧数据，从 rewards 表同步数据
update exchanges e
set 
  reward_name = r.name,
  points_cost = r.points_required
from rewards r
where e.reward_id = r.id
  and (e.reward_name = '' or e.points_cost = 0);

-- 4. 查看表结构确认
select column_name, data_type, is_nullable 
from information_schema.columns 
where table_name = 'exchanges' 
order by ordinal_position;

