import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, MD3LightTheme, configureFonts } from 'react-native-paper';
import { useFonts } from 'expo-font';
import { Text as RNText } from 'react-native';
import { AuthProvider, useAuth } from './lib/AuthContext';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import HomeScreen from './HomeScreen';
import AdminScreen from './AdminScreen';
import RewardsAdminScreen from './RewardsAdminScreen';
import { View, ActivityIndicator } from 'react-native';

const Stack = createNativeStackNavigator();

const baseFont = { fontFamily: 'NotoSansSC-Regular' as const };

const fontConfig = {
  displayLarge: baseFont,
  displayMedium: baseFont,
  displaySmall: baseFont,
  headlineLarge: baseFont,
  headlineMedium: baseFont,
  headlineSmall: baseFont,
  titleLarge: baseFont,
  titleMedium: baseFont,
  titleSmall: baseFont,
  labelLarge: baseFont,
  labelMedium: baseFont,
  labelSmall: baseFont,
  bodyLarge: baseFont,
  bodyMedium: baseFont,
  bodySmall: baseFont,
};

const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
};

function AppContent() {
  const { session, user } = useAuth();

  // 如果 session 还是 undefined (正在检查登录状态)，可以显示一个加载圈
  // 这里简单处理，直接判断 user 是否存在

  const isLoggedIn = !!user; // 明确转换为 boolean

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '我的积分' }} />
            <Stack.Screen name="Admin" component={AdminScreen} options={{ title: '积分管理' }} />
            <Stack.Screen name="RewardsAdmin" component={RewardsAdminScreen} options={{ title: '奖励管理' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'NotoSansSC-Regular': require('./assets/Noto_Sans_SC/static/NotoSansSC-Regular.ttf'),
    'NotoSansSC-Bold': require('./assets/Noto_Sans_SC/static/NotoSansSC-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  // 全局统一 React Native Text 的字体，防止系统回退导致粗细不一
  if (!RNText.defaultProps) {
    RNText.defaultProps = {};
  }
  RNText.defaultProps.style = [
    RNText.defaultProps.style,
    { fontFamily: 'NotoSansSC-Regular' },
  ];

  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </PaperProvider>
  );
}
