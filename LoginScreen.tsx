import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { TextInput, Button, Text, Title } from 'react-native-paper';
import { supabase } from './lib/supabase';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) Alert.alert('登录失败', error.message);
    setLoading(false);
  }

  function signUpWithEmail() {
    navigation.navigate('Register');
  }

  return (
    <View style={styles.container}>
      <Title style={styles.title}>✨ 家庭积分管理</Title>
      <Text style={styles.subtitle}>欢迎回来！</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          label="邮箱"
          value={email}
          onChangeText={(text) => setEmail(text)}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="密码"
          value={password}
          onChangeText={(text) => setPassword(text)}
          secureTextEntry={true}
          autoCapitalize="none"
          style={styles.input}
          mode="outlined"
        />
      </View>
      
      <Button 
        mode="contained" 
        onPress={signInWithEmail} 
        loading={loading}
        style={styles.loginButton}
        buttonColor="#FF6B9D"
      >
        登录
      </Button>

      <Button 
        mode="text" 
        onPress={signUpWithEmail} 
        style={styles.registerLink}
      >
        还没有账号？去注册
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF5F7',
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 40,
    fontSize: 16,
    color: '#666',
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  loginButton: {
    paddingVertical: 8,
    borderRadius: 25,
  },
  registerLink: {
    marginTop: 16,
  },
});
