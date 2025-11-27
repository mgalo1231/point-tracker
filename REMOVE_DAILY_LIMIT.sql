-- =====================================================
-- 移除每日加分次数限制
-- =====================================================

-- 1. 删除触发器
drop trigger if exists check_self_points_limit on points_history;

-- 2. 删除限制函数
drop function if exists check_daily_self_points_limit();

-- 完成！现在用户可以无限次自我加分了

