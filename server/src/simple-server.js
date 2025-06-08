const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

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

// 存储IP地址对应的用户信息
const ipUserMap = new Map();

// 存储用户账户数据（用户名+密码）
const userDatabase = new Map();

// 密码哈希轮数
const SALT_ROUNDS = 10;

// 密码验证函数
async function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: '密码不能为空' };
  }
  
  if (password.length < 6) {
    return { valid: false, message: '密码长度至少6个字符' };
  }
  
  if (password.length > 50) {
    return { valid: false, message: '密码长度不能超过50个字符' };
  }
  
  return { valid: true };
}

// 创建或验证用户账户
async function createOrValidateUser(userId, username, password) {
  try {
    // 检查用户是否已存在
    if (userDatabase.has(userId)) {
      const existingUser = userDatabase.get(userId);
      
      // 验证密码
      const passwordMatch = await bcrypt.compare(password, existingUser.passwordHash);
      if (!passwordMatch) {
        return { success: false, message: '密码错误' };
      }
      
      // 检查用户名是否匹配
      if (existingUser.username !== username) {
        return { success: false, message: '用户名与已注册的不匹配' };
      }
      
      return { 
        success: true, 
        user: existingUser,
        isNewUser: false 
      };
    } else {
      // 检查用户名是否被其他用户使用
      for (const [existingUserId, existingUser] of userDatabase.entries()) {
        if (existingUser.username.toLowerCase() === username.toLowerCase() && existingUserId !== userId) {
          return { success: false, message: '用户名已被其他用户使用' };
        }
      }
      
      // 创建新用户
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const newUser = {
        userId: userId,
        username: username,
        passwordHash: passwordHash,
        color: generateRandomColor(),
        createdAt: new Date(),
        lastLogin: new Date()
      };
      
      userDatabase.set(userId, newUser);
      console.log(`🆕 创建新用户账户: ${userId} (${username})`);
      
      return { 
        success: true, 
        user: newUser,
        isNewUser: true 
      };
    }
  } catch (error) {
    console.error('创建或验证用户错误:', error);
    return { success: false, message: '服务器错误，请重试' };
  }
}

// 生成随机颜色
function generateRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// 生成随机用户名
function generateRandomUsername() {
  const adjectives = ['快乐的', '勇敢的', '聪明的', '活泼的', '神秘的', '优雅的', '温柔的', '坚强的'];
  const nouns = ['创作者', '艺术家', '探索者', '建造者', '思考者', '梦想家', '冒险家', '设计师'];
  const randomNum = Math.floor(Math.random() * 1000);
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adjective}${noun}${randomNum}`;
}

// 获取客户端真实IP地址
function getClientIP(socket) {
  // 尝试从不同的头部获取真实IP
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  const realIP = socket.handshake.headers['x-real-ip'];
  const remoteAddress = socket.handshake.address;
  
  let clientIP;
  
  if (forwarded) {
    // x-forwarded-for 可能包含多个IP，取第一个
    clientIP = forwarded.split(',')[0].trim();
  } else if (realIP) {
    clientIP = realIP;
  } else {
    clientIP = remoteAddress;
  }
  
  // 处理IPv6映射的IPv4地址
  if (clientIP && clientIP.startsWith('::ffff:')) {
    clientIP = clientIP.substring(7);
  }
  
  return clientIP || 'unknown';
}

// 根据IP获取或创建用户信息
function getOrCreateUserByIP(ip, socketId) {
  if (ipUserMap.has(ip)) {
    const existingUser = ipUserMap.get(ip);
    // 更新socket ID但保持其他信息不变
    const updatedUser = {
      ...existingUser,
      id: socketId,
      lastConnected: new Date(),
      isOnline: true
    };
    ipUserMap.set(ip, updatedUser);
    console.log(`🔄 IP ${ip} 重新连接，用户: ${updatedUser.username}`);
    return updatedUser;
  } else {
    // 创建新用户
    const newUser = {
      id: socketId,
      username: generateRandomUsername(),
      color: generateRandomColor(),
      ip: ip,
      isOnline: true,
      createdAt: new Date(),
      lastConnected: new Date()
    };
    ipUserMap.set(ip, newUser);
    console.log(`🆕 新IP ${ip} 创建用户: ${newUser.username}`);
    return newUser;
  }
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
  const clientIP = getClientIP(socket);
  console.log(`🔗 用户连接: ${socket.id}, IP: ${clientIP}`);
  
  let currentUser = null;
  let currentRoomId = null;

  // 用户加入房间（支持用户名+密码登录）
  socket.on('join_room', async ({ roomId, username, userId, password }) => {
    try {
      console.log(`🚪 收到加入房间请求:`, { roomId, username, userId, socketId: socket.id });

      // 验证用户名
      if (!isValidUsername(username)) {
        socket.emit('error', { message: '用户名必须是2-20个字符' });
        return;
      }

      // 验证用户ID（如果提供）
      if (userId && (userId.trim().length < 3 || userId.trim().length > 20)) {
        socket.emit('error', { message: '用户ID必须是3-20个字符' });
        return;
      }

      // 验证密码
      const passwordValidation = await validatePassword(password);
      if (!passwordValidation.valid) {
        socket.emit('error', { message: passwordValidation.message });
        return;
      }

      // 创建或验证用户账户
      const finalUserId = userId ? userId.trim() : socket.id;
      const userValidation = await createOrValidateUser(finalUserId, username.trim(), password);
      
      if (!userValidation.success) {
        socket.emit('error', { message: userValidation.message });
        return;
      }

      const userAccount = userValidation.user;
      const isNewUser = userValidation.isNewUser;

      // 如果用户已经在其他房间，先离开
      if (currentRoomId && currentUser) {
        console.log(`🚪 离开旧房间: ${currentRoomId}`);
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

      // 获取房间并检查当前在线用户
      const room = getOrCreateRoom(roomId);
      
      // 检查用户是否已在房间中（防止重复登录）
      const existingRoomUser = Array.from(room.users.values()).find(
        user => user.customId === finalUserId && user.id !== socket.id
      );
      if (existingRoomUser) {
        socket.emit('error', { message: '该账户已在其他地方登录，请先退出或使用不同的账户' });
        return;
      }

      // 创建用户对象（房间内的用户信息）
      currentUser = {
        id: socket.id,
        customId: finalUserId,
        username: userAccount.username,
        color: userAccount.color,
        ip: clientIP,
        isOnline: true,
        joinedAt: new Date()
      };

      console.log(`👤 用户${isNewUser ? '注册并' : ''}登录成功:`, { 
        socketId: currentUser.id,
        customId: currentUser.customId,
        username: currentUser.username, 
        color: currentUser.color,
        isNewUser: isNewUser
      });

      // 更新用户最后登录时间
      userAccount.lastLogin = new Date();
      userDatabase.set(finalUserId, userAccount);

      currentRoomId = roomId;
      
      // 检查房间中是否已有相同socket ID的用户，如果有则替换
      for (const [userId, user] of room.users.entries()) {
        if (user.id === socket.id) {
          room.users.delete(userId);
          console.log(`🔄 替换房间中的旧连接: ${userId}`);
          break;
        }
      }
      
      // 加入房间
      socket.join(roomId);
      room.users.set(currentUser.id, currentUser);
      
      console.log(`🏠 用户已加入房间:`, { 
        roomId, 
        userId: currentUser.id,
        customId: currentUser.customId,
        username: currentUser.username,
        roomUsersCount: room.users.size,
        roomDrawingPathsCount: room.drawingPaths.length 
      });

      // 发送房间状态给新用户
      const roomState = {
        users: Array.from(room.users.values()),
        drawingPaths: room.drawingPaths
      };
      
      console.log(`📤 发送房间状态给用户 ${socket.id}:`, { 
        usersCount: roomState.users.length, 
        pathsCount: roomState.drawingPaths.length 
      });
      
      socket.emit('room_state', roomState);

      // 通知其他用户
      const userJoinedData = {
        user: currentUser,
        users: Array.from(room.users.values())
      };
      
      console.log(`📡 通知其他用户有新用户加入:`, { 
        newUserId: currentUser.id,
        newUserCustomId: currentUser.customId,
        newUsername: currentUser.username,
        totalUsers: userJoinedData.users.length 
      });
      
      socket.to(roomId).emit('user_joined', userJoinedData);

      console.log(`✅ 用户 ${currentUser.username} (ID: ${currentUser.customId}, IP: ${clientIP}) 成功${isNewUser ? '注册并' : ''}加入房间 ${roomId}`);
    } catch (error) {
      console.error('❌ 加入房间错误:', error);
      socket.emit('error', { message: '登录失败: ' + error.message });
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

  // 更新用户名
  socket.on('update_username', ({ username }) => {
    try {
      if (!currentUser) {
        socket.emit('error', { message: '用户未连接' });
        return;
      }

      // 验证用户名
      if (!isValidUsername(username)) {
        socket.emit('error', { message: '用户名必须是2-20个字符' });
        return;
      }

      // 检查用户名是否已存在（排除当前用户）
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const existingUser = Array.from(room.users.values()).find(
            user => user.username.toLowerCase() === username.toLowerCase() && user.id !== socket.id
          );
          if (existingUser) {
            socket.emit('error', { message: '用户名已存在，请选择其他用户名' });
            return;
          }
        }
      }

      const oldUsername = currentUser.username;
      
      // 更新用户名
      currentUser.username = username.trim();
      ipUserMap.set(clientIP, currentUser);

      // 更新房间中的用户信息
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.users.set(currentUser.id, currentUser);
          
          // 通知房间内其他用户
          socket.to(currentRoomId).emit('user_updated', {
            userId: currentUser.id,
            username: currentUser.username,
            users: Array.from(room.users.values())
          });
        }
      }

      // 确认更新成功
      socket.emit('username_updated', { 
        username: currentUser.username,
        oldUsername: oldUsername 
      });
      
      console.log(`🏷️ IP ${clientIP} 用户名从 "${oldUsername}" 更新为 "${username}"`);
    } catch (error) {
      console.error('更新用户名错误:', error);
      socket.emit('error', { message: '更新用户名失败' });
    }
  });

  // 用户断开连接
  socket.on('disconnect', () => {
    console.log(`用户断开连接: ${socket.id}, IP: ${clientIP}`);
    
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
      
      // 更新IP用户信息为离线状态，但保留用户数据
      if (ipUserMap.has(clientIP)) {
        const ipUser = ipUserMap.get(clientIP);
        ipUser.isOnline = false;
        ipUser.lastDisconnected = new Date();
        ipUserMap.set(clientIP, ipUser);
        console.log(`📴 IP ${clientIP} 用户 ${ipUser.username} 离线`);
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

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🌐 局域网访问: http://192.168.100.171:${PORT}`);
  }
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
}); 