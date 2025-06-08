# 🚀 Wonderland 云端部署指南

让全世界的人都能一起在无限画布上创作！

## 🎯 推荐方案：Vercel + Railway

这是最简单、免费的部署方案：

### 第一步：部署后端到 Railway

1. **访问 Railway**
   - 打开 [railway.app](https://railway.app)
   - 使用 GitHub 账号登录

2. **创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的 `wodnerland` 仓库

3. **配置服务**
   - Railway 会自动检测到这是一个 Node.js 项目
   - 在 "Settings" 中设置 Root Directory 为 `server`
   - 添加环境变量：
     ```
     NODE_ENV=production
     PORT=3001
     CLIENT_URL=https://your-app.vercel.app
     ```

4. **获取服务器地址**
   - 部署完成后，Railway 会提供一个类似 `https://your-app.railway.app` 的地址
   - 记下这个地址，下一步需要用到

### 第二步：部署前端到 Vercel

1. **访问 Vercel**
   - 打开 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择你的 `wodnerland` 仓库
   - 在 "Configure Project" 中：
     - Root Directory: `client`
     - Framework Preset: `Vite`

3. **设置环境变量**
   - 在 "Environment Variables" 中添加：
     ```
     VITE_SERVER_URL=https://your-app.railway.app
     ```
   - 将 `your-app.railway.app` 替换为第一步获得的 Railway 地址

4. **部署**
   - 点击 "Deploy"
   - 等待部署完成

### 第三步：更新 Railway 配置

1. **回到 Railway**
   - 在 Railway 项目的环境变量中
   - 更新 `CLIENT_URL` 为 Vercel 提供的地址：
     ```
     CLIENT_URL=https://your-app.vercel.app
     ```

2. **重新部署**
   - Railway 会自动重新部署服务器

## ✅ 完成！

现在你的 Wonderland 应用已经部署到云端了！

- 🌍 **前端地址**: `https://your-app.vercel.app`
- 🔧 **后端地址**: `https://your-app.railway.app`

## 🎨 分享给朋友

把 Vercel 地址分享给朋友们，大家就可以一起在无限画布上创作了！

## 🔧 故障排除

如果遇到问题：

1. **检查环境变量**
   - 确保 Vercel 中的 `VITE_SERVER_URL` 正确
   - 确保 Railway 中的 `CLIENT_URL` 正确

2. **查看日志**
   - Vercel: 在项目页面查看 "Functions" 日志
   - Railway: 在项目页面查看 "Deployments" 日志

3. **测试连接**
   - 访问 `https://your-app.railway.app/health` 检查服务器状态

## 🎉 享受创作！

现在全世界的人都可以在你的无限画布上一起创作了！🎨✨ 