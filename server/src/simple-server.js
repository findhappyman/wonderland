const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = createServer(app);

// 配置 CORS
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:3002",
    /^http:\/\/192\.168\.\d+\.\d+:3002$/,  // 允许局域网IP
    /^http:\/\/192\.168\.\d+\.\d+:3000$/,   // 允许局域网IP
    /^https:\/\/.*\.vercel\.app$/,          // 允许Vercel部署的域名
    process.env.CLIENT_URL                   // 允许环境变量指定的客户端地址
  ].filter(Boolean), // 过滤掉undefined值
  credentials: true
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "http://localhost:3002",
      /^http:\/\/192\.168\.\d+\.\d+:3002$/,  // 允许局域网IP
      /^http:\/\/192\.168\.\d+\.\d+:3000$/,   // 允许局域网IP
      /^https:\/\/.*\.vercel\.app$/,          // 允许Vercel部署的域名
      process.env.CLIENT_URL                   // 允许环境变量指定的客户端地址
    ].filter(Boolean), // 过滤掉undefined值
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 存储房间数据
const rooms = new Map();

// 生成随机颜色
function generateRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// 获取或创建房间
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      users: new Map(),
      drawingPaths: [],
      createdAt: new Date()
    });
  }
  return rooms.get(roomId);
}

// 用户名验证
function isValidUsername(username) {
  return username && username.trim().length >= 2 && username.trim().length <= 20;
}

// 检查用户名是否已存在
function isUsernameExists(roomId, username) {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  for (const user of room.users.values()) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      return true;
    }
  }
  return false;
}

io.on('connection', (socket) => {
  console.log(`用户连接: ${socket.id}`);
  
  let currentUser = null;
  let currentRoomId = null;

  // 用户加入房间
  socket.on('join_room', ({ roomId, username }) => {
    try {
      // 验证用户名
      if (!isValidUsername(username)) {
        socket.emit('error', { message: '用户名必须是2-20个字符' });
        return;
      }

      // 检查用户名是否已存在
      if (isUsernameExists(roomId, username)) {
        socket.emit('error', { message: '用户名已存在，请选择其他用户名' });
        return;
      }

      // 如果用户已经在其他房间，先离开
      if (currentRoomId && currentUser) {
        socket.leave(currentRoomId);
        const oldRoom = rooms.get(currentRoomId);
        if (oldRoom) {
          oldRoom.users.delete(currentUser.id);
          socket.to(currentRoomId).emit('user_left', {
            userId: currentUser.id,
            users: Array.from(oldRoom.users.values())
          });
        }
      }

      // 创建用户
      currentUser = {
        id: socket.id,
        username: username.trim(),
        color: generateRandomColor(),
        isOnline: true,
        joinedAt: new Date()
      };

      currentRoomId = roomId;
      const room = getOrCreateRoom(roomId);
      
      // 加入房间
      socket.join(roomId);
      room.users.set(currentUser.id, currentUser);

      // 发送房间状态给新用户
      socket.emit('room_state', {
        users: Array.from(room.users.values()),
        drawingPaths: room.drawingPaths
      });

      // 通知其他用户
      socket.to(roomId).emit('user_joined', {
        user: currentUser,
        users: Array.from(room.users.values())
      });

      console.log(`用户 ${username} 加入房间 ${roomId}`);
    } catch (error) {
      console.error('加入房间错误:', error);
      socket.emit('error', { message: '加入房间失败' });
    }
  });

  // 开始绘画
  socket.on('drawing_start', ({ roomId, path }) => {
    try {
      console.log('🎨 收到绘画开始请求:', { roomId, pathPointsCount: path.points.length, userId: currentUser?.id });
      
      if (!currentUser || currentRoomId !== roomId) {
        console.log('❌ 绘画开始失败 - 未授权:', { currentUser: !!currentUser, currentRoomId, roomId });
        socket.emit('error', { message: '未授权的操作' });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        console.log('❌ 绘画开始失败 - 房间不存在:', roomId);
        socket.emit('error', { message: '房间不存在' });
        return;
      }

      const drawingPath = {
        id: uuidv4(),
        userId: currentUser.id,
        username: currentUser.username,
        points: path.points,
        color: path.color,
        size: path.size,
        createdAt: new Date()
      };

      room.drawingPaths.push(drawingPath);
      console.log('✅ 绘画路径已创建:', { pathId: drawingPath.id, userId: drawingPath.userId, pointsCount: drawingPath.points.length });

      // 广播给房间内所有用户（包括自己）
      console.log('📡 广播绘画开始事件到房间:', { roomId, usersCount: room.users.size });
      io.to(roomId).emit('drawing_started', { path: drawingPath });
      
      console.log(`✅ 用户 ${currentUser.username} 开始绘画，路径ID: ${drawingPath.id}`);
    } catch (error) {
      console.error('❌ 开始绘画错误:', error);
      socket.emit('error', { message: '绘画失败' });
    }
  });

  // 更新绘画
  socket.on('drawing_update', ({ roomId, pathId, points }) => {
    try {
      if (!currentUser || currentRoomId !== roomId) {
        socket.emit('error', { message: '未授权的操作' });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }

      // 找到对应的绘画路径并验证所有权
      const pathIndex = room.drawingPaths.findIndex(p => p.id === pathId && p.userId === currentUser.id);
      if (pathIndex === -1) {
        socket.emit('error', { message: '无权修改此绘画' });
        return;
      }

      // 更新路径点
      room.drawingPaths[pathIndex].points = points;

      // 广播更新给所有用户（包括发起者）
      io.to(roomId).emit('drawing_updated', { pathId, points });
    } catch (error) {
      console.error('更新绘画错误:', error);
      socket.emit('error', { message: '更新绘画失败' });
    }
  });

  // 结束绘画
  socket.on('drawing_end', ({ roomId, pathId }) => {
    try {
      if (!currentUser || currentRoomId !== roomId) {
        return;
      }

      // 广播绘画结束给所有用户（包括发起者自己）
      io.to(roomId).emit('drawing_ended', { pathId });
      
      console.log(`用户 ${currentUser.username} 结束绘画，路径ID: ${pathId}`);
    } catch (error) {
      console.error('结束绘画错误:', error);
    }
  });

  // 光标移动
  socket.on('cursor_move', ({ roomId, x, y }) => {
    try {
      if (!currentUser || currentRoomId !== roomId) {
        return;
      }

      // 广播光标位置（不包括自己）
      socket.to(roomId).emit('cursor_moved', {
        userId: currentUser.id,
        x,
        y
      });
    } catch (error) {
      console.error('光标移动错误:', error);
    }
  });

  // 删除用户的所有绘画
  socket.on('clear_my_drawings', ({ roomId }) => {
    try {
      if (!currentUser || currentRoomId !== roomId) {
        socket.emit('error', { message: '未授权的操作' });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }

      // 删除当前用户的所有绘画
      const deletedPaths = room.drawingPaths.filter(p => p.userId === currentUser.id);
      room.drawingPaths = room.drawingPaths.filter(p => p.userId !== currentUser.id);

      // 广播删除事件给所有用户
      io.to(roomId).emit('drawings_cleared', { 
        userId: currentUser.id,
        deletedPathIds: deletedPaths.map(p => p.id)
      });
      
      console.log(`用户 ${currentUser.username} 清空了自己的绘画`);
    } catch (error) {
      console.error('清空绘画错误:', error);
      socket.emit('error', { message: '清空绘画失败' });
    }
  });

  // 用户断开连接
  socket.on('disconnect', () => {
    console.log(`用户断开连接: ${socket.id}`);
    
    if (currentUser && currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.users.delete(currentUser.id);
        
        // 通知其他用户
        socket.to(currentRoomId).emit('user_left', {
          userId: currentUser.id,
          users: Array.from(room.users.values())
        });

        // 如果房间为空，可以选择删除房间（可选）
        if (room.users.size === 0) {
          console.log(`房间 ${currentRoomId} 已空，保留绘画数据`);
        }
      }
    }
  });
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    totalUsers: Array.from(rooms.values()).reduce((sum, room) => sum + room.users.size, 0)
  });
});

// 获取房间信息
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: '房间不存在' });
  }

  res.json({
    id: room.id,
    userCount: room.users.size,
    drawingCount: room.drawingPaths.length,
    createdAt: room.createdAt
  });
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🌐 局域网访问: http://192.168.100.171:${PORT}`);
  }
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
}); 