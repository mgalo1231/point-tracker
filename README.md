# 积分追踪器 (Point Tracker)

这是一个使用 Expo 和 Supabase 构建的 React Native 应用程序，用于追踪积分。

## 前置要求

- Node.js (推荐 LTS 版本)
- npm 或 yarn
- iOS 模拟器 (仅限 Mac 用户) 或 Android 模拟器 (或者安装了 Expo Go 应用的真机)

## 安装

1. 克隆仓库 (如果适用) 或进入项目目录。
2. 安装依赖：

```bash
npm install
```

## 运行应用

启动开发服务器：

```bash
npx expo start
```

这将在终端中生成一个二维码。你可以使用移动设备上的 Expo Go 应用扫描此二维码。

### 平台特定命令

- **Android:**
  ```bash
  npm run android
  ```

- **iOS:** (仅限 Mac)
  ```bash
  npm run ios
  ```

- **Web:**
  ```bash
  npm run web
  ```

## 配置

本应用使用 Supabase 作为后端。Supabase 客户端初始化位于 `lib/supabase.ts` 文件中。
