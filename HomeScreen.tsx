import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text, Button, Title, Card, Paragraph, List, Divider, Chip, Avatar, IconButton, TextInput, Portal, Dialog, Switch } from 'react-native-paper';
import { useAuth } from './lib/AuthContext';
import { supabase } from './lib/supabase';
import { useNavigation } from '@react-navigation/native';

// 人性化时间显示函数
function getRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  
  // 超过7天显示具体日期
  return past.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

type HistoryItem = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  emoji: string | null;
  requires_approval: boolean;
  is_active: boolean;
};

type QuickAction = {
  id: string;
  label: string;
  points: number;
  emoji: string | null;
  type: 'positive' | 'negative';
  is_active: boolean;
};

function buildDailyStats(history: HistoryItem[]) {
  const days: { label: string; key: string; total: number; gain: number }[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const weekday = d.getDay(); // 0-6
    const label =
      i === 0
        ? '今'
        : ['日', '一', '二', '三', '四', '五', '六'][weekday];
    days.push({ label, key, total: 0, gain: 0 });
  }

  history.forEach((item) => {
    const key = item.created_at.slice(0, 10);
    const day = days.find((d) => d.key === key);
    if (day) {
      day.total += item.amount;
      if (item.amount > 0) {
        day.gain += item.amount;
      }
    }
  });

  return days;
}

export default function HomeScreen() {
  const { user, profile, signOut, isAdmin: isAdminRaw, refreshProfile } = useAuth();
  const navigation = useNavigation();
  
  // 确保 isAdmin 是布尔值
  const isAdmin = Boolean(isAdminRaw);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'store' | 'history'>('store');
  const [chartMode, setChartMode] = useState<'net' | 'gain'>('net');
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [editMode, setEditMode] = useState<boolean>(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  
  // Quick Actions 编辑相关
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionLabel, setActionLabel] = useState('');
  const [actionPoints, setActionPoints] = useState('');
  const [actionEmoji, setActionEmoji] = useState('');
  
  // Rewards 编辑相关
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
  const [rewardName, setRewardName] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardEmoji, setRewardEmoji] = useState('');
  const [rewardApproval, setRewardApproval] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('points_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setHistory(data);
    } else if (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchRewards = async () => {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_required', { ascending: true });

    if (error) {
      console.error('Error fetching rewards:', error);
      return;
    }

    setRewards(data || []);
  };

  const fetchQuickActions = async () => {
    const { data, error } = await supabase
      .from('quick_actions')
      .select('*')
      .eq('is_active', true)
      .eq('type', 'positive') // 首页只显示 positive 类型的自我加分
      .order('points', { ascending: true });

    if (error) {
      console.error('Error fetching quick actions:', error);
      return;
    }
    setQuickActions(data || []);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchHistory(), fetchRewards(), fetchQuickActions()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHistory();
    fetchRewards();
    fetchQuickActions();
  }, [user]);

  const handleEditReward = (reward: Reward) => {
    setEditingReward(reward);
    setRewardName(reward.name);
    setRewardDesc(reward.description || '');
    setRewardPoints(String(reward.points_required));
    setRewardEmoji(reward.emoji || '🎁');
    setRewardApproval(reward.requires_approval);
    setIsRewardDialogOpen(true);
  };

  const handleAddReward = () => {
    setEditingReward(null);
    setRewardName('');
    setRewardDesc('');
    setRewardPoints('');
    setRewardEmoji('🎁');
    setRewardApproval(false);
    setIsRewardDialogOpen(true);
  };

  const handleSaveReward = async () => {
    if (!rewardName || !rewardPoints) {
      Alert.alert('提示', '请填写名称和积分');
      return;
    }
    const pts = parseInt(rewardPoints, 10);
    if (isNaN(pts) || pts <= 0) {
      Alert.alert('提示', '请输入有效的积分');
      return;
    }

    try {
      if (editingReward) {
        // 更新
        const { error } = await supabase
          .from('rewards')
          .update({
            name: rewardName,
            description: rewardDesc,
            points_required: pts,
            emoji: rewardEmoji,
            requires_approval: rewardApproval,
          })
          .eq('id', editingReward.id);
        if (error) throw error;
      } else {
        // 新增
        const { error } = await supabase
          .from('rewards')
          .insert({
            name: rewardName,
            description: rewardDesc,
            points_required: pts,
            emoji: rewardEmoji,
            requires_approval: rewardApproval,
            is_active: true,
          });
        if (error) throw error;
      }
      setIsRewardDialogOpen(false);
      fetchRewards();
    } catch (err: any) {
      Alert.alert('保存失败', err.message);
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!window.confirm('确定要删除这个奖励吗？')) return;
    
    try {
      console.log('=== 开始删除奖励 ===');
      console.log('奖励 ID:', id);
      console.log('当前用户:', user?.id);
      console.log('是否管理员:', isAdmin);
      
      // 软删除：只设置 is_active = false
      const { data, error } = await supabase
        .from('rewards')
        .update({ is_active: false })
        .eq('id', id)
        .select();
      
      console.log('删除响应 data:', data);
      console.log('删除响应 error:', error);
      
      if (error) {
        console.error('❌ 删除失败:', error);
        alert(`删除失败: ${error.message}\n错误代码: ${error.code}`);
        return;
      }
      
      console.log('✅ 删除成功');
      alert('删除成功，该奖励已被停用');
      await fetchRewards(); // 重新加载列表
    } catch (err: any) {
      console.error('❌ 捕获到异常:', err);
      alert(`删除失败: ${err.message}`);
    }
  };

  const handleEditAction = (action: QuickAction) => {
    setEditingAction(action);
    setActionLabel(action.label);
    setActionPoints(String(action.points));
    setActionEmoji(action.emoji || '🎉');
    setIsActionDialogOpen(true);
  };

  const handleAddAction = () => {
    setEditingAction(null);
    setActionLabel('');
    setActionPoints('');
    setActionEmoji('🎉');
    setIsActionDialogOpen(true);
  };

  const handleSaveAction = async () => {
    if (!actionLabel || !actionPoints) {
      Alert.alert('提示', '请填写完整信息');
      return;
    }
    const pts = parseInt(actionPoints, 10);
    if (isNaN(pts) || pts <= 0) {
      Alert.alert('提示', '请输入有效的积分');
      return;
    }

    try {
      if (editingAction) {
        // 更新
        const { error } = await supabase
          .from('quick_actions')
          .update({
            label: actionLabel,
            points: pts,
            emoji: actionEmoji,
          })
          .eq('id', editingAction.id);
        if (error) throw error;
      } else {
        // 新增
        const { error } = await supabase
          .from('quick_actions')
          .insert({
            label: actionLabel,
            points: pts,
            emoji: actionEmoji,
            type: 'positive',
            is_active: true,
          });
        if (error) throw error;
      }
      setIsActionDialogOpen(false);
      fetchQuickActions();
    } catch (err: any) {
      Alert.alert('保存失败', err.message);
    }
  };

  const handleDeleteAction = async (id: string) => {
    Alert.alert('确认删除', '确定要删除这个任务吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('quick_actions')
              .delete()
              .eq('id', id);
            if (error) throw error;
            fetchQuickActions();
          } catch (err: any) {
            Alert.alert('删除失败', err.message);
          }
        },
      },
    ]);
  };

  const currentPoints = profile?.points ?? 0;
  const canPlayHours = Math.floor(currentPoints / 50);
  const remainingPoints = currentPoints % 50;

  const handleRedeem = async (reward: Reward) => {
    if (!user) {
      Alert.alert('提示', '请先登录');
      return;
    }

    if (currentPoints < reward.points_required) {
      Alert.alert('积分不足', '当前积分不够兑换这个奖励');
      return;
    }

    setRedeemingId(reward.id);

    try {
      if (reward.requires_approval) {
        // 大奖励：创建待审批的兑换记录
        const { error: exchangeError } = await supabase
          .from('exchanges')
          .insert({
            user_id: user.id,
            reward_id: reward.id,
            points_spent: reward.points_required,
            status: 'pending',
          });

        if (exchangeError) throw exchangeError;

        Alert.alert('已提交申请', '等待管理员批准');
      } else {
        // 小奖励：直接扣分并记录历史
        const { error: historyError } = await supabase
          .from('points_history')
          .insert({
            user_id: user.id,
            amount: -reward.points_required,
            reason: `兑换：${reward.name}`,
            created_by: user.id,
          });

        if (historyError) throw historyError;

        const { error: exchangeError } = await supabase
          .from('exchanges')
          .insert({
            user_id: user.id,
            reward_id: reward.id,
            points_spent: reward.points_required,
            status: 'completed',
          });

        if (exchangeError) throw exchangeError;

        Alert.alert('兑换成功', `已成功兑换：${reward.name}`);
        await Promise.all([refreshProfile(), fetchHistory()]);
      }
    } catch (error: any) {
      console.error('Redeem error:', error);
      Alert.alert('兑换失败', error.message || '请稍后再试');
    } finally {
      setRedeemingId(null);
    }
  };

  const dailyStats = buildDailyStats(history);
  const maxAbs = Math.max(
    10,
    ...dailyStats.map((d) =>
      chartMode === 'net' ? Math.abs(d.total) : d.gain,
    ),
  );

  // 顶部概要：最近7天和今天的加分/扣分
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 6);

  const weekly = history.filter((h) => {
    const d = new Date(h.created_at);
    return d >= weekAgo && d <= now;
  });
  const weeklyGain = weekly.reduce(
    (sum, h) => (h.amount > 0 ? sum + h.amount : sum),
    0,
  );
  const weeklySpend = weekly.reduce(
    (sum, h) => (h.amount < 0 ? sum - h.amount : sum),
    0,
  );

  const todayKey = now.toISOString().slice(0, 10);
  const todayRecords = history.filter((h) =>
    h.created_at.startsWith(todayKey),
  );
  const todayNet = todayRecords.reduce((sum, h) => sum + h.amount, 0);

  const todaySelfRecords = todayRecords.filter((h) =>
    h.reason.startsWith('自我加分：'),
  );
  const todaySelfMaxCount = 5;
  const todaySelfCount = todaySelfRecords.length;
  const todaySelfReasons = new Set(
    todaySelfRecords.map((h) => h.reason.replace('自我加分：', '')),
  );

  const formatHistoryTitle = (item: HistoryItem): string => {
    const { amount, reason } = item;
    if (reason.startsWith('自我加分：')) {
      const task = reason.replace('自我加分：', '');
      return `${task} · 自我奖励`;
    }
    if (reason.startsWith('兑换：')) {
      const name = reason.replace('兑换：', '');
      return `兑换「${name}」`;
    }
    if (amount > 0) {
      return `管理员奖励：${reason}`;
    }
    if (amount < 0) {
      return `管理员扣分：${reason}`;
    }
    return reason;
  };

  const formatHistorySubtitle = (item: HistoryItem): string => {
    const { amount, reason, created_at } = item;
    const timeText = getRelativeTime(created_at);
    if (reason.startsWith('兑换：')) {
      const pts = Math.abs(amount);
      return `${timeText} · 消耗 ${pts} 分`;
    }
    if (amount > 0) {
      return `${timeText} · +${amount} 分`;
    }
    if (amount < 0) {
      return `${timeText} · ${amount} 分`;
    }
    return timeText;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Portal>
          <Dialog visible={isActionDialogOpen} onDismiss={() => setIsActionDialogOpen(false)} style={{ backgroundColor: 'white' }}>
            <Dialog.Title>{editingAction ? '编辑任务' : '新增任务'}</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="任务名称"
                value={actionLabel}
                onChangeText={setActionLabel}
                style={{ marginBottom: 12, backgroundColor: 'white' }}
                mode="outlined"
              />
              <TextInput
                label="积分"
                value={actionPoints}
                onChangeText={setActionPoints}
                keyboardType="numeric"
                style={{ marginBottom: 12, backgroundColor: 'white' }}
                mode="outlined"
              />
              <TextInput
                label="Emoji (可选)"
                value={actionEmoji}
                onChangeText={setActionEmoji}
                maxLength={2}
                style={{ backgroundColor: 'white' }}
                mode="outlined"
                placeholder="🎉"
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setIsActionDialogOpen(false)}>取消</Button>
              <Button onPress={handleSaveAction}>保存</Button>
            </Dialog.Actions>
          </Dialog>

          <Dialog visible={isRewardDialogOpen} onDismiss={() => setIsRewardDialogOpen(false)} style={{ backgroundColor: 'white' }}>
            <Dialog.Title>{editingReward ? '编辑奖励' : '新增奖励'}</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="奖励名称"
                value={rewardName}
                onChangeText={setRewardName}
                style={{ marginBottom: 12, backgroundColor: 'white' }}
                mode="outlined"
              />
              <TextInput
                label="描述 (可选)"
                value={rewardDesc}
                onChangeText={setRewardDesc}
                style={{ marginBottom: 12, backgroundColor: 'white' }}
                mode="outlined"
              />
              <TextInput
                label="所需积分"
                value={rewardPoints}
                onChangeText={setRewardPoints}
                keyboardType="numeric"
                style={{ marginBottom: 12, backgroundColor: 'white' }}
                mode="outlined"
              />
              <TextInput
                label="Emoji (可选)"
                value={rewardEmoji}
                onChangeText={setRewardEmoji}
                maxLength={2}
                style={{ marginBottom: 12, backgroundColor: 'white' }}
                mode="outlined"
                placeholder="🎁"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text>需要管理员批准？</Text>
                <Switch value={rewardApproval} onValueChange={setRewardApproval} color="#FF6B9D" />
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setIsRewardDialogOpen(false)}>取消</Button>
              <Button onPress={handleSaveReward}>保存</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        {/* 积分卡片 - 可爱风格 */}
        <Card style={styles.pointsCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              {profile?.avatar_url ? (
                <Avatar.Image size={64} source={{ uri: profile.avatar_url }} />
              ) : (
                <Avatar.Text size={64} label={profile?.nickname?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'} />
              )}
              <View style={styles.profileInfo}>
                <Title style={styles.userName}>{profile?.nickname || user?.email?.split('@')[0]}</Title>
                <Text style={styles.userRole}>
                  {isAdmin ? '👑 管理员' : '🎮 玩家'}
                </Text>
              </View>
              {isAdmin && (
                <View style={styles.editToggle}>
                  <Text style={{ marginRight: 8, color: '#666' }}>编辑模式</Text>
                  <Switch value={!!editMode} onValueChange={(val) => setEditMode(!!val)} color="#FF6B9D" />
                </View>
              )}
            </View>
            
            <View style={styles.pointsSection}>
              <Text style={styles.cardEmoji}>✨</Text>
              <Title style={styles.cardTitle}>我的积分</Title>
              <Text style={styles.points}>{currentPoints}</Text>
            </View>
          </Card.Content>
          {isAdmin && (
            <Card.Actions style={styles.cardActions}>
              <Button 
                mode="contained" 
                onPress={() => navigation.navigate('Admin' as never)}
                style={styles.adminButton}
                buttonColor="#FF6B9D"
              >
                管理积分 ⚡
              </Button>
            </Card.Actions>
          )}
        </Card>

        {/* 顶部概要 Chip */}
        <View style={styles.summaryRow}>
          <Chip style={styles.summaryChip} textStyle={styles.summaryChipText}>
            近7天获得：{weeklyGain} 分
          </Chip>
          <Chip style={styles.summaryChip} textStyle={styles.summaryChipText}>
            近7天兑换：-{weeklySpend} 分
          </Chip>
          <Chip style={styles.summaryChip} textStyle={styles.summaryChipText}>
            今日净变化：{todayNet > 0 ? `+${todayNet}` : todayNet}
          </Chip>
        </View>

        {/* 宽屏双栏布局 */}
        <View style={isWide ? styles.mainRow : undefined}>
          <View style={isWide ? styles.leftColumn : undefined}>
            {/* 最近7天积分柱状图 */}
            <Card style={styles.statsCard}>
              <Card.Content>
                <Text style={styles.storeTitle}>📊 最近7天积分变化</Text>
                <View style={styles.chartTabsRow}>
                  <Button
                    mode={chartMode === 'net' ? 'contained' : 'text'}
                    onPress={() => setChartMode('net')}
                    style={[
                      styles.chartTabButton,
                      chartMode === 'net' && styles.chartTabButtonActive,
                    ]}
                    labelStyle={[
                      styles.chartTabLabel,
                      chartMode === 'net' && styles.chartTabLabelActive,
                    ]}
                  >
                    净变化
                  </Button>
                  <Button
                    mode={chartMode === 'gain' ? 'contained' : 'text'}
                    onPress={() => setChartMode('gain')}
                    style={[
                      styles.chartTabButton,
                      chartMode === 'gain' && styles.chartTabButtonActive,
                    ]}
                    labelStyle={[
                      styles.chartTabLabel,
                      chartMode === 'gain' && styles.chartTabLabelActive,
                    ]}
                  >
                    获得积分
                  </Button>
                </View>
                <View style={styles.chartRow}>
                  {dailyStats.map((day) => {
                    const rawValue =
                      chartMode === 'net' ? day.total : day.gain;
                    const value = rawValue;
                    const height =
                      (Math.abs(value) / maxAbs) * 80 +
                      (value === 0 ? 4 : 8);
                    const isPositive = value >= 0;
                    const valueLabel =
                      value === 0
                        ? ''
                        : value > 0
                        ? `+${value}`
                        : `${value}`;

                    return (
                      <View key={day.key} style={styles.chartBarWrapper}>
                        <View style={styles.chartBarContainer}>
                          <Text style={styles.chartValue}>{valueLabel}</Text>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height,
                                backgroundColor: isPositive
                                  ? '#4CAF50'
                                  : '#FF5252',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartLabel}>{day.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card.Content>
            </Card>

            {/* 自我加分任务（用户自己按按钮加分） / 管理加分任务（管理员编辑模式） */}
            {(isAdmin || !editMode) && (
              <Card style={styles.selfTasksCard}>
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.selfTasksTitle}>
                      {editMode ? '🛠 管理加分任务' : '✅ 今天完成了什么？点一下就加分'}
                    </Text>
                  </View>
                  
                  {(!editMode && todaySelfCount >= todaySelfMaxCount) && (
                    <Text style={styles.selfTasksHint}>
                      今日自我加分已达上限（{todaySelfMaxCount} 次）
                    </Text>
                  )}
                  
                  <View style={styles.selfTasksGrid}>
                    {quickActions.map((action) => (
                      <View key={action.id} style={styles.selfTaskWrapper}>
                        <TouchableOpacity
                          style={[
                            styles.selfTaskButton,
                            !editMode && (todaySelfReasons.has(action.label) || todaySelfCount >= todaySelfMaxCount) && styles.selfTaskButtonDisabled,
                          ]}
                          onPress={async () => {
                            if (editMode) return; // 编辑模式下点击本身无反应，靠右上角按钮
                            
                            if (
                              todaySelfReasons.has(action.label) ||
                              todaySelfCount >= todaySelfMaxCount
                            ) {
                              return;
                            }
                            if (!user) return;

                            try {
                              const { error } = await supabase
                                .from('points_history')
                                .insert({
                                  user_id: user.id,
                                  amount: action.points,
                                  reason: `自我加分：${action.label}`,
                                  created_by: user.id,
                                });

                              if (error) throw error;

                              Alert.alert(
                                '太棒了！',
                                `已为自己加 ${action.points} 分 ✨`,
                              );
                              await Promise.all([
                                refreshProfile(),
                                fetchHistory(),
                              ]);
                            } catch (err: any) {
                              console.error(
                                'Self quick action error:',
                                err,
                              );
                              Alert.alert(
                                '加分失败',
                                err.message || '请稍后再试',
                              );
                            }
                          }}
                        >
                          <Text style={styles.selfTaskEmoji}>
                            {action.emoji || '🎉'}
                          </Text>
                          <Text style={styles.selfTaskLabel}>
                            {!editMode && todaySelfReasons.has(action.label)
                              ? `${action.label} · 今日已完成`
                              : action.label}
                          </Text>
                          <Text style={styles.selfTaskPoints}>
                            +{action.points}
                          </Text>
                        </TouchableOpacity>
                        
                        {/* 编辑模式下的操作按钮 */}
                        {editMode && (
                          <View style={styles.editActionButtons}>
                            <IconButton
                              icon="pencil"
                              size={16}
                              style={{ margin: 0 }}
                              onPress={() => handleEditAction(action)}
                            />
                            <IconButton
                              icon="delete"
                              size={16}
                              iconColor="#FF5252"
                              style={{ margin: 0 }}
                              onPress={() => handleDeleteAction(action.id)}
                            />
                          </View>
                        )}
                      </View>
                    ))}
                    
                    {/* 编辑模式下的新增按钮 */}
                    {editMode && (
                      <TouchableOpacity
                        style={[styles.selfTaskButton, styles.addActionBtn]}
                        onPress={handleAddAction}
                      >
                        <Text style={{ fontSize: 24, marginBottom: 4 }}>➕</Text>
                        <Text style={{ color: '#666' }}>新增任务</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card.Content>
              </Card>
            )}
          </View>

          <View style={isWide ? styles.rightColumn : undefined}>
            {/* 兑换规则卡片 */}
            <Card style={styles.exchangeCard}>
              <Card.Content>
                <View style={styles.exchangeHeader}>
                  <Text style={styles.exchangeTitle}>🎁 兑换规则</Text>
                </View>
            <View style={styles.exchangeRow}>
              <Chip
                icon="clock-outline"
                style={styles.chip}
                textStyle={styles.chipText}
              >
                50 分 = 1 小时游戏
              </Chip>
            </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusText}>
                    {canPlayHours > 0
                      ? `🎉 可以玩 ${canPlayHours} 小时啦！`
                      : `💪 再赚 ${
                          50 - remainingPoints
                        } 分就能玩 1 小时了！`}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            {/* 顶部标签切换：商店 / 历史 */}
            <View style={styles.tabsRow}>
              <Button
                mode={activeTab === 'store' ? 'contained' : 'text'}
                onPress={() => setActiveTab('store')}
                style={[
                  styles.tabButton,
                  activeTab === 'store' && styles.tabButtonActive,
                ]}
                labelStyle={[
                  styles.tabLabel,
                  activeTab === 'store' && styles.tabLabelActive,
                ]}
              >
                🛍️ 积分商店
              </Button>
              <Button
                mode={activeTab === 'history' ? 'contained' : 'text'}
                onPress={() => setActiveTab('history')}
                style={[
                  styles.tabButton,
                  activeTab === 'history' && styles.tabButtonActive,
                ]}
                labelStyle={[
                  styles.tabLabel,
                  activeTab === 'history' && styles.tabLabelActive,
                ]}
              >
                📋 积分记录
              </Button>
            </View>

            {activeTab === 'store' && (
              <Card style={styles.storeCard}>
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.storeTitle}>🛍️ 积分商店</Text>
                    {editMode && (
                      <Button mode="contained-tonal" onPress={handleAddReward} compact icon="plus">
                        新增奖励
                      </Button>
                    )}
                  </View>
                  
                  {rewards.length === 0 ? (
                    <Text style={styles.emptyText}>
                      还没有可兑换的奖励～
                    </Text>
                  ) : (
                    rewards.map((reward) => (
                      <View key={reward.id} style={styles.rewardRow}>
                        <View style={styles.rewardInfo}>
                          <Text style={styles.rewardEmoji}>
                            {reward.emoji || '🎁'}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.rewardName}>
                              {reward.name}
                            </Text>
                            {reward.description ? (
                              <Text style={styles.rewardDesc}>
                                {reward.description}
                              </Text>
                            ) : null}
                            <Text style={styles.rewardPoints}>
                              {reward.points_required} 分
                            </Text>
                          </View>
                          {reward.requires_approval && (
                            <Chip compact style={styles.approvalChip} textStyle={styles.chipText}>
                              需管理员批准
                            </Chip>
                          )}
                        </View>
                        
                        {editMode ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                            <Button mode="outlined" onPress={() => handleEditReward(reward)} compact>
                              编辑
                            </Button>
                            <Button mode="outlined" textColor="#FF5252" onPress={() => handleDeleteReward(reward.id)} compact>
                              删除
                            </Button>
                          </View>
                        ) : (
                          <Button
                            mode="contained"
                            onPress={() => handleRedeem(reward)}
                            loading={redeemingId === reward.id}
                            disabled={
                              currentPoints < reward.points_required
                            }
                            style={styles.redeemButton}
                            buttonColor={
                              reward.requires_approval
                                ? '#FFB74D'
                                : '#4CAF50'
                            }
                          >
                            {reward.requires_approval
                              ? '申请兑换'
                              : '立即兑换'}
                          </Button>
                        )}
                      </View>
                    ))
                  )}
                </Card.Content>
              </Card>
            )}

            {activeTab === 'history' && (
              <View style={styles.historySection}>
                <Title style={styles.sectionTitle}>📋 最近记录</Title>
                <View style={styles.historyContainer}>
                  {history.length === 0 ? (
                    <Text style={styles.emptyText}>
                      还没有记录哦～
                    </Text>
                  ) : (
                    history.map((item) => (
                      <React.Fragment key={item.id}>
                        <List.Item
                          title={formatHistoryTitle(item)}
                          titleStyle={styles.historyTitle}
                          description={formatHistorySubtitle(item)}
                          descriptionStyle={styles.historyTime}
                          left={() => (
                            <View style={styles.historyIcon}>
                              <Text style={styles.historyEmoji}>
                                {item.amount > 0 ? '🎉' : '⚠️'}
                              </Text>
                            </View>
                          )}
                          right={() => (
                            <Text
                              style={[
                                styles.amount,
                                {
                                  color:
                                    item.amount > 0
                                      ? '#4CAF50'
                                      : '#FF5252',
                                },
                              ]}
                            >
                              {item.amount > 0
                                ? `+${item.amount}`
                                : item.amount}
                            </Text>
                          )}
                        />
                        <Divider />
                      </React.Fragment>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        <Button
          mode="text"
          onPress={signOut}
          style={styles.logoutButton}
          labelStyle={styles.logoutLabel}
        >
        退出登录
      </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    marginBottom: 12,
  },
  summaryChip: {
    backgroundColor: '#FFE5F0',
  },
  summaryChipText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
  },
  mainRow: {
    flexDirection: 'row',
    columnGap: 16,
    alignItems: 'flex-start',
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  pointsCard: {
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#999',
  },
  pointsSection: {
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    textAlign: 'center',
    fontSize: 18,
    color: '#666',
  },
  points: {
    fontSize: 56,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#FF6B9D',
    marginVertical: 12,
  },
  cardActions: {
    justifyContent: 'center',
    paddingBottom: 16,
  },
  adminButton: {
    borderRadius: 25,
  },
  selfTasksCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  selfTasksTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  selfTasksHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  selfTasksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  selfTaskWrapper: {
    width: '48%',
    marginBottom: 8,
  },
  selfTaskButton: {
    width: '100%',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  addActionBtn: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#DDD',
    borderStyle: 'dashed',
    justifyContent: 'center',
    width: '48%',
  },
  editActionButtons: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
  },
  selfTaskButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  selfTaskEmoji: {
    fontSize: 26,
    marginBottom: 4,
  },
  selfTaskLabel: {
    fontSize: 14,
    color: '#333',
  },
  selfTaskPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 2,
  },
  exchangeCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFF9E6',
    elevation: 2,
  },
  exchangeHeader: {
    marginBottom: 12,
  },
  exchangeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  exchangeRow: {
    marginVertical: 8,
  },
  chip: {
    backgroundColor: '#FFE5F0',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
  },
  statusRow: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  statusText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 999,
    backgroundColor: '#FFE5F0',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 14,
    color: '#AA6B8F',
  },
  tabLabelActive: {
    color: '#FF6B9D',
    fontWeight: 'bold',
  },
  storeCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  storeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  rewardRow: {
    marginBottom: 12,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  rewardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rewardEmoji: {
    fontSize: 28,
    marginRight: 8,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rewardDesc: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  rewardPoints: {
    fontSize: 13,
    color: '#FF6B9D',
    marginTop: 4,
  },
  approvalChip: {
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  redeemButton: {
    alignSelf: 'flex-end',
    borderRadius: 20,
    marginTop: 4,
  },
  statsCard: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  chartTabsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
  },
  chartTabButton: {
    flex: 1,
    borderRadius: 999,
  },
  chartTabButtonActive: {
    backgroundColor: '#FFE5F0',
  },
  chartTabLabel: {
    fontSize: 13,
    color: '#AA6B8F',
  },
  chartTabLabelActive: {
    color: '#FF6B9D',
    fontWeight: 'bold',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
    height: 110,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 90,
  },
  chartValue: {
    fontSize: 11,
    color: '#555',
    marginBottom: 2,
  },
  chartBar: {
    width: 10,
    borderRadius: 6,
  },
  chartLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
  },
  historySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 12,
    color: '#333',
  },
  historyContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 1,
  },
  historyTitle: {
    fontSize: 16,
  },
  historyTime: {
    fontSize: 13,
    color: '#999',
  },
  historyIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
  },
  historyEmoji: {
    fontSize: 24,
  },
  amount: {
    fontSize: 20,
    alignSelf: 'center',
    marginRight: 10,
  },
  emptyText: {
    padding: 30,
    textAlign: 'center',
    color: '#999',
    fontSize: 15,
  },
  logoutButton: {
    marginTop: 30,
    borderRadius: 25,
  },
  logoutLabel: {
    fontSize: 16,
    color: '#7B4DCC',
    fontWeight: '400',
  },
});
