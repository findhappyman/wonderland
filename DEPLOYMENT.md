# 🚀 无限画布 - 部署指南

让全世界的人都能一起画画！🎨🌍

## 📋 部署方案

### 方案一：Vercel + Railway（推荐）

#### 1. 前端部署到 Vercel

1. **准备代码**
   ```bash
   cd client
   npm install
   npm run build  # 测试构建
   ```

2. **部署到 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 连接你的 GitHub 仓库
   - 选择 `client` 目录作为根目录
   - 设置环境变量：
     ```
     VITE_SERVER_URL=https://your-server-domain.railway.app
     ```

#### 2. 后端部署到 Railway

1. **准备代码**
   ```bash
   cd server
   npm install
   ```

2. **部署到 Railway**
   - 访问 [railway.app](https://railway.app)
   - 连接你的 GitHub 仓库
   - 选择 `server` 目录
   - 设置环境变量：
     ```
     NODE_ENV=production
     CLIENT_URL=https://your-app.vercel.app
     ```

### 方案二：Heroku（经典选择）

#### 前端 + 后端一起部署

1. **创建 Heroku 应用**
   ```bash
   heroku create your-infinite-canvas
   ```

2. **设置环境变量**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set CLIENT_URL=https://your-infinite-canvas.herokuapp.com
   ```

3. **部署**
   ```bash
   git push heroku main
   ```

### 方案三：自己的服务器（VPS）

#### 使用 PM2 + Nginx

1. **安装依赖**
   ```bash
   # 安装 Node.js, PM2, Nginx
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   sudo apt-get install nginx
   ```

2. **部署应用**
   ```bash
   # 克隆代码
   git clone your-repo
   cd wodnerland
   
   # 安装依赖
   cd server && npm install
   cd ../client && npm install && npm run build
   
   # 启动服务器
   cd ../server
   pm2 start src/simple-server.js --name "infinite-canvas"
   pm2 save
   pm2 startup
   ```

3. **配置 Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       # 前端静态文件
       location / {
           root /path/to/client/dist;
           try_files $uri $uri/ /index.html;
       }
       
       # 后端 API
       location /socket.io/ {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
       
       location /api/ {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 🔧 环境变量配置

### 客户端 (client)
```bash
VITE_SERVER_URL=https://your-server-domain.com
```

### 服务器 (server)
```bash
NODE_ENV=production
PORT=3001
CLIENT_URL=https://your-client-domain.com
```

## 🌍 域名配置

### 免费域名选项
- **Freenom**: .tk, .ml, .ga 域名
- **GitHub Pages**: username.github.io
- **Vercel**: 自动提供 .vercel.app 域名
- **Railway**: 自动提供 .railway.app 域名

### 自定义域名
1. 购买域名（推荐：Namecheap, GoDaddy）
2. 配置 DNS 记录指向你的服务器
3. 设置 SSL 证书（Let's Encrypt 免费）

## 📊 监控和维护

### 性能监控
- 使用 PM2 监控服务器状态
- 设置日志轮转
- 配置内存和 CPU 警报

### 数据备份
- 定期备份绘画数据
- 设置自动备份脚本

### 扩展性考虑
- 使用 Redis 存储会话数据
- 配置负载均衡
- 考虑 CDN 加速静态资源

## 🎨 上线后的功能

部署成功后，用户可以：
- 🌍 **全球访问**: 任何人都能通过网址访问
- 👥 **实时协作**: 多人同时在线绘画
- 📱 **移动友好**: 手机和平板完美支持
- 🎯 **无限画布**: 支持缩放和拖动
- 🔒 **权限控制**: 只能修改自己的作品
- 🎨 **个性化**: 每个用户有独特的颜色标识

## 🚀 快速开始

1. **Fork 这个仓库**
2. **选择部署方案**（推荐 Vercel + Railway）
3. **设置环境变量**
4. **部署并测试**
5. **分享给朋友们一起画画！**

---

🎉 **恭喜！你的无限画布现在可以让全世界的人一起创作了！**

有问题？欢迎提 Issue 或联系我们！ 