import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Title, TextInput, Card, Switch, Chip } from 'react-native-paper';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/AuthContext';

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  emoji: string | null;
  requires_approval: boolean;
  is_active: boolean;
};

export default function RewardsAdminScreen() {
  const { user, isAdmin } = useAuth();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pointsRequired, setPointsRequired] = useState('');
  const [emoji, setEmoji] = useState('🎁');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('points_required', { ascending: true });

    if (error) {
      console.error('Error fetching rewards:', error);
      Alert.alert('加载失败', error.message);
      return;
    }

    setRewards(data || []);
  };

  const handleCreate = async () => {
    if (!name || !pointsRequired) {
      Alert.alert('提示', '请填写奖励名称和所需积分');
      return;
    }

    const points = parseInt(pointsRequired, 10);
    if (isNaN(points) || points <= 0) {
      Alert.alert('提示', '请输入有效的积分数值');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('rewards').insert({
        name,
        description: description || null,
        points_required: points,
        emoji,
        requires_approval: requiresApproval,
        is_active: true,
      });

      if (error) throw error;

      setName('');
      setDescription('');
      setPointsRequired('');
      setEmoji('🎁');
      setRequiresApproval(false);
      fetchRewards();
    } catch (error: any) {
      console.error('Create reward error:', error);
      Alert.alert('创建失败', error.message || '请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (reward: Reward) => {
    try {
      const { error } = await supabase
        .from('rewards')
        .update({ is_active: !reward.is_active })
        .eq('id', reward.id);

      if (error) throw error;

      fetchRewards();
    } catch (error: any) {
      console.error('Toggle active error:', error);
      Alert.alert('操作失败', error.message || '请稍后再试');
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text>只有管理员可以管理奖励。</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Title style={styles.headerTitle}>🎁 奖励管理</Title>

        {/* 新增奖励表单 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>新增奖励</Text>
            <TextInput
              label="名称 *"
              value={name}
              onChangeText={setName}
              style={styles.input}
              mode="outlined"
              placeholder="例如：30分钟游戏时间"
            />
            <TextInput
              label="描述"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              mode="outlined"
              placeholder="可选：简单说明奖励内容"
            />
            <TextInput
              label="所需积分 *"
              value={pointsRequired}
              onChangeText={setPointsRequired}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
            />
            <TextInput
              label="Emoji"
              value={emoji}
              onChangeText={setEmoji}
              style={styles.input}
              mode="outlined"
              maxLength={4}
            />

            <View style={styles.switchRow}>
              <Text>需要管理员批准</Text>
              <Switch
                value={requiresApproval}
                onValueChange={setRequiresApproval}
              />
            </View>

            <Button
              mode="contained"
              onPress={handleCreate}
              loading={loading}
              style={styles.createButton}
              buttonColor="#FF6B9D"
            >
              创建奖励
            </Button>
          </Card.Content>
        </Card>

        {/* 已有奖励列表 */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>已有奖励</Text>
            {rewards.length === 0 ? (
              <Text style={styles.emptyText}>还没有创建奖励～</Text>
            ) : (
              rewards.map((reward) => (
                <View key={reward.id} style={styles.rewardRow}>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardEmoji}>{reward.emoji || '🎁'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rewardName}>{reward.name}</Text>
                      {reward.description ? (
                        <Text style={styles.rewardDesc}>{reward.description}</Text>
                      ) : null}
                      <Text style={styles.rewardPoints}>{reward.points_required} 分</Text>
                      <View style={styles.chipRow}>
                        {reward.requires_approval && (
                          <Chip compact style={styles.chip}>需审批</Chip>
                        )}
                        <Chip compact style={styles.chip}>
                          {reward.is_active ? '已启用' : '已停用'}
                        </Chip>
                      </View>
                    </View>
                  </View>
                  <View style={styles.switchRow}>
                    <Text>{reward.is_active ? '停用' : '启用'}</Text>
                    <Switch
                      value={reward.is_active}
                      onValueChange={() => toggleActive(reward)}
                    />
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
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
    padding: 16,
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#FF6B9D',
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
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  createButton: {
    marginTop: 12,
    borderRadius: 25,
  },
  emptyText: {
    paddingVertical: 12,
    color: '#999',
  },
  rewardRow: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 8,
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
  chipRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 6,
  },
  chip: {
    marginRight: 4,
  },
});


