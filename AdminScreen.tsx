import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, Title, TextInput, RadioButton, Card, IconButton, Portal, Dialog } from 'react-native-paper';
import { supabase } from './lib/supabase';
import { useAuth, UserProfile } from './lib/AuthContext';

type QuickAction = {
  id: string;
  label: string;
  points: number;
  emoji: string | null;
  type: 'positive' | 'negative';
  is_active: boolean;
};

type Exchange = {
  id: string;
  user_id: string;
  reward_id: string;
  reward_name: string;
  points_cost: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  profiles?: {
    nickname: string | null;
    email: string;
  };
};

export default function AdminScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  
  // 管理扣分任务的状态
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<QuickAction | null>(null);
  const [taskLabel, setTaskLabel] = useState('');
  const [taskPoints, setTaskPoints] = useState('');
  const [taskEmoji, setTaskEmoji] = useState('⚠️');
  
  // 兑换审批相关
  const [pendingExchanges, setPendingExchanges] = useState<Exchange[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchQuickActions();
    fetchPendingExchanges();
  }, []);

  const fetchUsers = async () => {
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('*')
      .order('email');

    if (usersError) {
      console.error("Fetch users error:", usersError);
      Alert.alert('Error fetching users', usersError.message);
      return;
    }

    // 额外获取每个用户的实时总分
    if (usersData) {
      const usersWithPoints = await Promise.all(usersData.map(async (u) => {
        const { data: history } = await supabase
          .from('points_history')
          .select('amount')
          .eq('user_id', u.id);
        
        const total = history ? history.reduce((acc, curr) => acc + curr.amount, 0) : 0;
        return { ...u, points: total };
      }));

      setUsers(usersWithPoints);
      
      if (usersWithPoints.length > 0 && !selectedUserId) {
        setSelectedUserId(usersWithPoints[0].id);
      }
    }
  };

  const fetchPendingExchanges = async () => {
    console.log('获取待审批兑换...');
    const { data, error } = await supabase
      .from('exchanges')
      .select(`
        *,
        profiles:user_id (nickname, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取待审批兑换错误:', error);
      return;
    }

    console.log('待审批兑换:', data);
    setPendingExchanges(data || []);
  };

  const handleApproveExchange = async (exchange: Exchange) => {
    console.log('批准兑换:', exchange);
    setProcessingId(exchange.id);
    
    try {
      // 1. 扣除用户积分
      const { error: historyError } = await supabase
        .from('points_history')
        .insert({
          user_id: exchange.user_id,
          amount: -exchange.points_cost,
          reason: `兑换：${exchange.reward_name}（管理员批准）`,
          created_by: user?.id,
        });

      if (historyError) {
        console.error('插入积分历史错误:', historyError);
        throw historyError;
      }

      console.log('积分已扣除，更新兑换状态...');

      // 2. 更新兑换状态
      const { error: updateError } = await supabase
        .from('exchanges')
        .update({
          status: 'approved',
          approved_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exchange.id);

      if (updateError) {
        console.error('更新兑换状态错误:', updateError);
        throw updateError;
      }

      console.log('兑换已批准，刷新数据...');
      alert('✅ 已批准兑换申请！用户积分已扣除');
      await fetchPendingExchanges();
      await fetchUsers(); // 刷新用户积分
    } catch (err: any) {
      console.error('批准兑换失败:', err);
      alert(`批准失败: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectExchange = async (exchange: Exchange, note: string = '') => {
    console.log('拒绝兑换:', exchange, '理由:', note);
    setProcessingId(exchange.id);
    
    try {
      const { error } = await supabase
        .from('exchanges')
        .update({
          status: 'rejected',
          admin_note: note || '管理员拒绝了此兑换申请',
          approved_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exchange.id);

      if (error) {
        console.error('更新兑换状态错误:', error);
        throw error;
      }

      console.log('兑换已拒绝，刷新数据...');
      alert('❌ 已拒绝兑换申请');
      await fetchPendingExchanges();
    } catch (err: any) {
      console.error('拒绝兑换失败:', err);
      alert(`拒绝失败: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const fetchQuickActions = async () => {
    const { data, error } = await supabase
      .from('quick_actions')
      .select('*')
      .eq('is_active', true)
      // 不过滤 type，因为下面会分别显示（现在只显示扣分，但保持灵活性）
      .order('type', { ascending: false })
      .order('points', { ascending: true });

    if (error) {
      console.error('Fetch quick actions error:', error);
      return;
    }

    setQuickActions(data || []);
  };

  // 快捷操作
  const handleQuickAction = async (actionReason: string, actionPoints: number, isPositive: boolean) => {
    if (!selectedUserId) {
      Alert.alert('提示', '请先选择一个家庭成员');
      return;
    }

    const finalAmount = isPositive ? actionPoints : -actionPoints;
    setLoading(true);

    try {
      const { error: historyError } = await supabase
        .from('points_history')
        .insert({
          user_id: selectedUserId,
          amount: finalAmount,
          reason: actionReason,
          created_by: user?.id
        });

      if (historyError) throw historyError;

      Alert.alert('成功', `${isPositive ? '奖励' : '扣除'} ${actionPoints} 分 ✨`);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('操作失败', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 自定义操作
  const handleCustomAction = async (isAddition: boolean) => {
    if (!selectedUserId || !amount || !reason) {
      Alert.alert('错误', '请填写完整信息');
      return;
    }

    const pointsValue = parseInt(amount);
    if (isNaN(pointsValue) || pointsValue <= 0) {
      Alert.alert('错误', '请输入有效的积分数值');
      return;
    }

    const finalAmount = isAddition ? pointsValue : -pointsValue;
    setLoading(true);

    try {
      const { error: historyError } = await supabase
        .from('points_history')
        .insert({
          user_id: selectedUserId,
          amount: finalAmount,
          reason: reason,
          created_by: user?.id
        });

      if (historyError) throw historyError;

      Alert.alert('成功', `已${isAddition ? '奖励' : '扣除'}积分`);
      setAmount('');
      setReason('');
      setShowCustomInput(false);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('操作失败', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 打开新增/编辑扣分任务对话框
  const handleAddTask = () => {
    setEditingTask(null);
    setTaskLabel('');
    setTaskPoints('');
    setTaskEmoji('⚠️');
    setIsTaskDialogOpen(true);
  };

  const handleEditTask = (task: QuickAction) => {
    setEditingTask(task);
    setTaskLabel(task.label);
    setTaskPoints(String(task.points));
    setTaskEmoji(task.emoji || '⚠️');
    setIsTaskDialogOpen(true);
  };

  // 保存扣分任务
  const handleSaveTask = async () => {
    if (!taskLabel.trim() || !taskPoints.trim()) {
      Alert.alert('错误', '请填写完整信息');
      return;
    }

    const points = parseInt(taskPoints);
    if (isNaN(points) || points <= 0) {
      Alert.alert('错误', '请输入有效的积分数值');
      return;
    }

    try {
      if (editingTask) {
        // 编辑现有任务
        const { error } = await supabase
          .from('quick_actions')
          .update({
            label: taskLabel,
            points: points,
            emoji: taskEmoji,
          })
          .eq('id', editingTask.id);

        if (error) throw error;
        Alert.alert('成功', '扣分任务已更新');
      } else {
        // 新增任务
        const { error } = await supabase
          .from('quick_actions')
          .insert({
            label: taskLabel,
            points: points,
            emoji: taskEmoji,
            type: 'negative',
            is_active: true,
          });

        if (error) throw error;
        Alert.alert('成功', '扣分任务已添加');
      }

      setIsTaskDialogOpen(false);
      fetchQuickActions();
    } catch (err: any) {
      console.error('Save task error:', err);
      Alert.alert('保存失败', err.message);
    }
  };

  // 删除扣分任务
  const handleDeleteTask = async (id: string) => {
    Alert.alert('确认删除', '确定要删除这个扣分任务吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            // 软删除：设置 is_active = false
            const { error } = await supabase
              .from('quick_actions')
              .update({ is_active: false })
              .eq('id', id);

            if (error) throw error;
            Alert.alert('删除成功', '该任务已被停用');
            fetchQuickActions();
          } catch (err: any) {
            console.error('Delete task error:', err);
            Alert.alert('删除失败', err.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Title style={styles.headerTitle}>⚠️ 扣分管理</Title>

        {/* 待审批兑换 */}
        {pendingExchanges.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>🎁 待审批兑换 ({pendingExchanges.length})</Text>
              {pendingExchanges.map((exchange) => (
                <View key={exchange.id} style={styles.exchangeCard}>
                  <View style={styles.exchangeInfo}>
                    <Text style={styles.exchangeUser}>
                      用户：{exchange.profiles?.nickname || exchange.profiles?.email || '未知用户'}
                    </Text>
                    <Text style={styles.exchangeReward}>
                      🎁 申请兑换：{exchange.reward_name}
                    </Text>
                    <Text style={styles.exchangePoints}>
                      💰 所需积分：{exchange.points_cost} 分
                    </Text>
                    <Text style={styles.exchangeTime}>
                      🕐 申请时间：{new Date(exchange.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </View>
                  <View style={styles.exchangeActions}>
                    <Button
                      mode="contained"
                      onPress={() => {
                        if (window.confirm(`确定批准用户兑换"${exchange.reward_name}"吗？\n将扣除 ${exchange.points_cost} 积分`)) {
                          handleApproveExchange(exchange);
                        }
                      }}
                      disabled={processingId === exchange.id}
                      loading={processingId === exchange.id}
                      style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                      compact
                    >
                      ✅ 批准
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        const note = window.prompt('请输入拒绝理由（可选）:');
                        if (note !== null) {
                          handleRejectExchange(exchange, note || '管理员拒绝了此申请');
                        }
                      }}
                      disabled={processingId === exchange.id}
                      style={styles.actionBtn}
                      compact
                    >
                      ❌ 拒绝
                    </Button>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* 选择成员 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>👥 选择成员</Text>
            <RadioButton.Group onValueChange={newValue => setSelectedUserId(newValue)} value={selectedUserId || ''}>
              {users.map(u => (
                <View key={u.id} style={styles.userRow}>
                  <RadioButton.Item 
                    label={`${u.nickname || u.email?.split('@')[0] || u.email} (${u.points}分)`} 
                    value={u.id} 
                    style={styles.radioItem}
                  />
                </View>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* 管理扣分任务 */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>🛠 管理扣分任务</Text>
              <Button 
                mode="contained" 
                onPress={handleAddTask}
                style={{ backgroundColor: '#FF6B9D' }}
                compact
              >
                + 新增
              </Button>
            </View>
            <View style={styles.quickActionsGrid}>
              {quickActions.filter(a => a.type === 'negative').length === 0 ? (
                <Text style={styles.emptyHint}>点击"新增"按钮添加扣分任务</Text>
              ) : (
                quickActions
                  .filter(a => a.type === 'negative')
                  .map((action) => (
                    <View key={action.id} style={[styles.taskCard, styles.negativeTaskCard]}>
                      <Text style={styles.taskEmoji}>{action.emoji || '⚠️'}</Text>
                      <Text style={styles.taskLabel}>{action.label}</Text>
                      <Text style={styles.taskPoints}>-{action.points}分</Text>
                      <View style={styles.taskActions}>
                        <IconButton
                          icon="pencil"
                          size={18}
                          onPress={() => handleEditTask(action)}
                          style={styles.taskIconButton}
                        />
                        <IconButton
                          icon="delete"
                          size={18}
                          onPress={() => handleDeleteTask(action.id)}
                          style={styles.taskIconButton}
                        />
                      </View>
                    </View>
                  ))
              )}
            </View>
          </Card.Content>
        </Card>

        {/* 快捷扣分操作 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>⚠️ 扣除积分</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.filter(a => a.type === 'negative').length === 0 ? (
                <Text style={styles.emptyHint}>先添加扣分任务</Text>
              ) : (
                quickActions
                  .filter(a => a.type === 'negative')
                  .map((action) => (
                    <TouchableOpacity
                      key={action.id}
                      style={[styles.quickButton, styles.negativeButton]}
                      onPress={() => handleQuickAction(action.label, action.points, false)}
                      disabled={loading || !selectedUserId}
                    >
                      <Text style={styles.quickButtonEmoji}>{action.emoji || '⚠️'}</Text>
                      <Text style={styles.quickButtonLabel}>{action.label}</Text>
                      <Text style={styles.quickButtonPointsNegative}>-{action.points}</Text>
                    </TouchableOpacity>
                  ))
              )}
            </View>
          </Card.Content>
        </Card>

        {/* 自定义操作 */}
        <Card style={styles.card}>
          <Card.Content>
            <TouchableOpacity 
              style={styles.customToggle}
              onPress={() => setShowCustomInput(!showCustomInput)}
            >
              <Text style={styles.sectionTitle}>
                ✏️ 自定义操作 {showCustomInput ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>
            
            {showCustomInput && (
              <>
                <TextInput
                  label="原因"
                  value={reason}
                  onChangeText={setReason}
                  style={styles.input}
                  mode="outlined"
                  placeholder="例如：特别任务"
                />
                <TextInput
                  label="积分数值"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  style={styles.input}
                  mode="outlined"
                  placeholder="输入分数"
                />

                <View style={styles.buttonRow}>
                  <Button 
                    mode="contained" 
                    onPress={() => handleCustomAction(true)} 
                    style={[styles.actionButton, { backgroundColor: '#4caf50' }]}
                    loading={loading}
                    icon="plus"
                  >
                    奖励
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={() => handleCustomAction(false)} 
                    style={[styles.actionButton, { backgroundColor: '#f44336' }]}
                    loading={loading}
                    icon="minus"
                  >
                    扣除
                  </Button>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* 新增/编辑扣分任务对话框 */}
      <Portal>
        <Dialog visible={isTaskDialogOpen} onDismiss={() => setIsTaskDialogOpen(false)}>
          <Dialog.Title>{editingTask ? '编辑扣分任务' : '新增扣分任务'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="任务名称"
              value={taskLabel}
              onChangeText={setTaskLabel}
              mode="outlined"
              placeholder="例如：游戏超时"
              style={styles.dialogInput}
            />
            <TextInput
              label="扣除积分"
              value={taskPoints}
              onChangeText={setTaskPoints}
              keyboardType="numeric"
              mode="outlined"
              placeholder="例如：20"
              style={styles.dialogInput}
            />
            <TextInput
              label="图标 Emoji"
              value={taskEmoji}
              onChangeText={setTaskEmoji}
              mode="outlined"
              placeholder="例如：⚠️"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsTaskDialogOpen(false)}>取消</Button>
            <Button onPress={handleSaveTask}>保存</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#FF6B9D',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 2,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioItem: {
    flex: 1,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  quickButton: {
    width: '48%',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  negativeButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FF5252',
  },
  quickButtonEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  quickButtonPoints: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  quickButtonPointsNegative: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF5252',
  },
  emptyHint: {
    width: '100%',
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  customToggle: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 25,
  },
  taskCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF5252',
    position: 'relative',
  },
  negativeTaskCard: {
    backgroundColor: '#FFF5F5',
  },
  taskEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  taskLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  taskPoints: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF5252',
    marginBottom: 4,
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  taskIconButton: {
    margin: 0,
  },
  dialogInput: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  exchangeCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  exchangeInfo: {
    marginBottom: 12,
  },
  exchangeUser: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  exchangeReward: {
    fontSize: 15,
    color: '#FF6B9D',
    marginBottom: 4,
  },
  exchangePoints: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  exchangeTime: {
    fontSize: 12,
    color: '#999',
  },
  exchangeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
});
