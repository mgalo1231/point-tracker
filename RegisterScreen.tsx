import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform, Image, ScrollView } from 'react-native';
import { TextInput, Button, Text, Title, Avatar } from 'react-native-paper';
import { supabase } from './lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    // 请求权限
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要权限', '请允许访问相册以选择头像');
      return;
    }

    // 选择图片
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarUri) return null;

    try {
      // Web 平台处理
      if (Platform.OS === 'web') {
        const response = await fetch(avatarUri);
        const blob = await response.blob();
        const fileExt = 'jpg';
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data.publicUrl;
      } 
      // 移动端处理
      else {
        const fileExt = avatarUri.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const formData = new FormData();
        formData.append('file', {
          uri: avatarUri,
          type: 'image/jpeg',
          name: fileName,
        } as any);

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, formData);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data.publicUrl;
      }
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  async function handleRegister() {
    // 验证
    if (!email || !password || !nickname) {
      Alert.alert('错误', '请填写所有必填项');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('错误', '两次密码不一致');
      return;
    }

    if (password.length < 6) {
      Alert.alert('错误', '密码至少需要6位');
      return;
    }

    setLoading(true);

    try {
      // 1. 注册用户
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('注册失败，请重试');
      }

      // 2. 先等待一下确保触发器执行
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. 上传头像（如果有）
      let avatarUrl = null;
      if (avatarUri) {
        console.log('Starting avatar upload...');
        avatarUrl = await uploadAvatar(authData.user.id);
        console.log('Avatar uploaded:', avatarUrl);
      }
      
      // 4. 检查 profile 是否已存在
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single();

      if (existingProfile) {
        // 如果存在就更新
        console.log('Profile exists, updating...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            nickname: nickname,
            avatar_url: avatarUrl
          })
          .eq('id', authData.user.id);

        if (updateError) {
          console.error('Profile update error:', updateError);
          Alert.alert('提示', '昵称/头像保存失败: ' + updateError.message);
        } else {
          console.log('Profile updated successfully');
        }
      } else {
        // 如果不存在就插入（触发器可能失败了）
        console.log('Profile does not exist, inserting...');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({ 
            id: authData.user.id,
            email: email,
            nickname: nickname,
            avatar_url: avatarUrl,
            is_admin: false,
            points: 0
          });

        if (insertError) {
          console.error('Profile insert error:', insertError);
          Alert.alert('提示', '昵称/头像保存失败: ' + insertError.message);
        } else {
          console.log('Profile inserted successfully');
        }
      }

      if (Platform.OS === 'web') {
        window.alert('注册成功！请检查邮箱验证（如需要），然后登录。');
      } else {
        Alert.alert('注册成功！', '请检查邮箱验证（如需要），然后登录。');
      }

      // 返回登录页
      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('注册失败', error.message);
      console.error('Signup error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Title style={styles.title}>创建账号 ✨</Title>
        
        {/* 头像选择 */}
        <View style={styles.avatarSection}>
          <Avatar.Image 
            size={100} 
            source={avatarUri ? { uri: avatarUri } : require('./assets/icon.png')}
            style={styles.avatar}
          />
          <Button mode="outlined" onPress={pickImage} style={styles.avatarButton}>
            选择头像
          </Button>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            label="昵称 *"
            value={nickname}
            onChangeText={setNickname}
            style={styles.input}
            mode="outlined"
            placeholder="给自己起个可爱的名字"
          />
          
          <TextInput
            label="邮箱 *"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            mode="outlined"
          />
          
          <TextInput
            label="密码 *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            style={styles.input}
            mode="outlined"
            placeholder="至少6位"
          />
          
          <TextInput
            label="确认密码 *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            style={styles.input}
            mode="outlined"
          />
        </View>

        <Button 
          mode="contained" 
          onPress={handleRegister} 
          loading={loading}
          style={styles.registerButton}
          buttonColor="#FF6B9D"
        >
          注册
        </Button>

        <Button 
          mode="text" 
          onPress={() => navigation.navigate('Login')}
          style={styles.loginLink}
        >
          已有账号？去登录
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
    paddingTop: 40,
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    marginBottom: 16,
    backgroundColor: '#FFE5F0',
  },
  avatarButton: {
    borderRadius: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  registerButton: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 25,
  },
  loginLink: {
    marginTop: 16,
  },
});

