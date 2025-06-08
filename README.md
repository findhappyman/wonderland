# 无限画布 - 全球协作绘画平台

一个支持实时多人协作的无限画布绘画应用，让全世界的人都能在同一个画布上创作。

## ✨ 特性

- 🎨 **无限画布**: 支持无限缩放和平移的画布
- 👥 **实时协作**: 多人同时在线绘画，实时同步
- 🎯 **精确绘画**: 支持多种画笔工具和颜色选择
- 👀 **用户光标**: 实时显示其他用户的光标位置
- 🔄 **自动同步**: 所有绘画内容实时同步到所有用户
- 📱 **响应式设计**: 支持桌面和移动设备

## 🛠️ 技术栈

### 前端
- **React 18** + **TypeScript**
- **Vite** - 快速构建工具
- **Fabric.js** - 强大的画布库
- **Socket.io Client** - 实时通信

### 后端
- **Node.js** + **Express**
- **Socket.io** - WebSocket实时通信
- **TypeScript** - 类型安全
- **内存存储** - 快速数据访问

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装和运行

1. **克隆项目**
```bash
git clone <repository-url>
cd wodnerland
```

2. **安装依赖**
```bash
# 安装服务器依赖
cd server
npm install

# 安装客户端依赖
cd ../client
npm install
```

3. **启动服务器**
```bash
cd server
npm run dev
```
服务器将在 http://localhost:3001 启动

4. **启动客户端**
```bash
cd client
npm run dev
```
客户端将在 http://localhost:3000 启动

5. **开始绘画**
打开浏览器访问 http://localhost:3000，开始你的创作之旅！

## 🎮 使用说明

### 基本操作
- **绘画**: 鼠标左键拖拽
- **移动画布**: 右键拖拽 或 空格键+拖拽
- **缩放**: 鼠标滚轮
- **选择工具**: 使用左上角工具栏
- **选择颜色**: 点击颜色选择器或预设颜色
- **调整画笔大小**: 使用大小滑块

### 协作功能
- **实时绘画**: 你的绘画会实时显示给其他用户
- **用户光标**: 可以看到其他用户的光标位置
- **在线用户**: 右上角显示当前在线用户列表
- **用户标识**: 每个用户有独特的颜色和名称

## 📁 项目结构

```
wodnerland/
├── client/                 # 前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   │   ├── InfiniteCanvas.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── UserPanel.tsx
│   │   ├── hooks/          # 自定义Hooks
│   │   │   └── useSocket.ts
│   │   ├── types/          # TypeScript类型定义
│   │   │   └── index.ts
│   │   ├── utils/          # 工具函数
│   │   │   └── user.ts
│   │   ├── App.tsx         # 主应用组件
│   │   └── main.tsx        # 应用入口
│   ├── public/             # 静态资源
│   └── package.json
├── server/                 # 后端服务器
│   ├── src/
│   │   ├── services/       # 业务服务
│   │   │   └── RoomManager.ts
│   │   ├── types/          # TypeScript类型定义
│   │   │   └── index.ts
│   │   └── index.ts        # 服务器入口
│   └── package.json
└── README.md
```

## 🔧 开发

### 开发模式
```bash
# 启动服务器开发模式（自动重启）
cd server
npm run dev

# 启动客户端开发模式（热重载）
cd client
npm run dev
```

### 构建生产版本
```bash
# 构建服务器
cd server
npm run build

# 构建客户端
cd client
npm run build
```

## 🌐 部署

### 环境变量
创建 `.env` 文件：

**服务器端 (server/.env)**
```
NODE_ENV=production
PORT=3001
```

**客户端 (client/.env)**
```
VITE_SERVER_URL=https://your-server-domain.com
```

### Docker 部署
```bash
# 构建镜像
docker build -t infinite-canvas-server ./server
docker build -t infinite-canvas-client ./client

# 运行容器
docker run -p 3001:3001 infinite-canvas-server
docker run -p 3000:3000 infinite-canvas-client
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🎯 未来计划

- [ ] 用户认证和个人画板
- [ ] 绘画历史记录和回放
- [ ] 更多绘画工具（形状、文字等）
- [ ] 图层支持
- [ ] 导出功能（PNG、SVG等）
- [ ] 房间系统（私人画板）
- [ ] 移动端优化
- [ ] 数据库持久化
- [ ] 性能优化和缓存

## 💡 灵感

这个项目的灵感来自于让艺术创作变得更加开放和协作的想法。我们相信，当全世界的人们能够在同一个画布上自由创作时，会产生令人惊叹的艺术作品。

---

**让我们一起在无限的画布上创造无限的可能！** 🎨✨ 