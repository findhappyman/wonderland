const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');

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

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../data');
const USER_DATABASE_FILE = path.join(DATA_DIR, 'users.json');
const ROOMS_DATABASE_FILE = path.join(DATA_DIR, 'rooms.json');

// 存储房间数据
const rooms = new Map();

// 存储IP地址对应的用户信息
const ipUserMap = new Map();

// 存储用户账户数据（用户名作为主键）
const userDatabase = new Map();

// 密码哈希轮数
const SALT_ROUNDS = 10;

// 确保数据目录存在
async function ensureDataDirectory() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('📁 数据目录已就绪:', DATA_DIR);
  } catch (error) {
    console.error('❌ 创建数据目录失败:', error);
  }
}

// 加载用户数据
async function loadUserDatabase() {
  try {
    const data = await fs.readFile(USER_DATABASE_FILE, 'utf8');
    const users = JSON.parse(data);
    
    for (const [username, userData] of Object.entries(users)) {
      userDatabase.set(username, {
        ...userData,
        createdAt: new Date(userData.createdAt),
        lastLogin: userData.lastLogin ? new Date(userData.lastLogin) : new Date()
      });
    }
    
    console.log(`📚 已加载 ${userDatabase.size} 个用户账户`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📚 用户数据文件不存在，将创建新文件');
    } else {
      console.error('❌ 加载用户数据失败:', error);
    }
  }
}

// 保存用户数据
async function saveUserDatabase() {
  try {
    const users = {};
    for (const [username, userData] of userDatabase.entries()) {
      users[username] = {
        ...userData,
        createdAt: userData.createdAt.toISOString(),
        lastLogin: userData.lastLogin.toISOString()
      };
    }
    
    await fs.writeFile(USER_DATABASE_FILE, JSON.stringify(users, null, 2));
    console.log(`💾 已保存 ${userDatabase.size} 个用户账户`);
  } catch (error) {
    console.error('❌ 保存用户数据失败:', error);
  }
}

// 加载房间数据
async function loadRoomsDatabase() {
  try {
    const data = await fs.readFile(ROOMS_DATABASE_FILE, 'utf8');
    const roomsData = JSON.parse(data);
    
    for (const [roomId, roomData] of Object.entries(roomsData)) {
      rooms.set(roomId, {
        ...roomData,
        users: new Map(), // 在线用户列表在重启时清空
        drawingPaths: roomData.drawingPaths.map(path => ({
          ...path,
          createdAt: new Date(path.createdAt)
        })),
        createdAt: new Date(roomData.createdAt)
      });
    }
    
    console.log(`🏠 已加载 ${rooms.size} 个房间，${Array.from(rooms.values()).reduce((sum, room) => sum + room.drawingPaths.length, 0)} 个绘画路径`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('🏠 房间数据文件不存在，将创建新文件');
    } else {
      console.error('❌ 加载房间数据失败:', error);
    }
  }
}

// 保存房间数据
async function saveRoomsDatabase() {
  try {
    const roomsData = {};
    for (const [roomId, roomData] of rooms.entries()) {
      roomsData[roomId] = {
        id: roomData.id,
        drawingPaths: roomData.drawingPaths.map(path => ({
          ...path,
          createdAt: path.createdAt.toISOString()
        })),
        createdAt: roomData.createdAt.toISOString()
      };
    }
    
    await fs.writeFile(ROOMS_DATABASE_FILE, JSON.stringify(roomsData, null, 2));
    const totalPaths = Array.from(rooms.values()).reduce((sum, room) => sum + room.drawingPaths.length, 0);
    console.log(`💾 已保存 ${rooms.size} 个房间，${totalPaths} 个绘画路径`);
  } catch (error) {
    console.error('❌ 保存房间数据失败:', error);
  }
}

// 定期保存数据（每5分钟）
setInterval(async () => {
  await saveUserDatabase();
  await saveRoomsDatabase();
}, 5 * 60 * 1000);

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

// 创建或验证用户账户（以用户名为主键）
async function createOrValidateUser(username, password, providedUserId) {
  try {
    const normalizedUsername = username.toLowerCase();
    
    // 检查用户是否已存在（以用户名为主键）
    if (userDatabase.has(normalizedUsername)) {
      const existingUser = userDatabase.get(normalizedUsername);
      
      // 验证密码
      const passwordMatch = await bcrypt.compare(password, existingUser.passwordHash);
      if (!passwordMatch) {
        return { success: false, message: '用户名或密码错误' };
      }
      
      // 更新最后登录时间
      existingUser.lastLogin = new Date();
      userDatabase.set(normalizedUsername, existingUser);
      
      return { 
        success: true, 
        user: existingUser,
        isNewUser: false 
      };
    } else {
      // 创建新用户（用户名作为唯一标识）
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const newUser = {
        username: username, // 保持原始大小写
        normalizedUsername: normalizedUsername,
        providedUserId: providedUserId, // 记录用户提供的ID，但不作为主键
        passwordHash: passwordHash,
        color: generateRandomColor(),
        createdAt: new Date(),
        lastLogin: new Date()
      };
      
      userDatabase.set(normalizedUsername, newUser);
      await saveUserDatabase(); // 立即保存新用户
      console.log(`🆕 创建新用户账户: ${username} (ID: ${providedUserId})`);
      
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
      const userValidation = await createOrValidateUser(username.trim(), password, finalUserId);
      
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
        user => user.normalizedUsername === userAccount.normalizedUsername && user.id !== socket.id
      );
      if (existingRoomUser) {
        socket.emit('error', { message: '该账户已在其他地方登录，请先退出或使用不同的账户' });
        return;
      }

      // 创建用户对象（房间内的用户信息）
      currentUser = {
        id: socket.id,
        username: userAccount.username, // 使用原始大小写的用户名
        normalizedUsername: userAccount.normalizedUsername,
        providedUserId: finalUserId,
        color: userAccount.color,
        ip: clientIP,
        isOnline: true,
        joinedAt: new Date()
      };

      console.log(`👤 用户${isNewUser ? '注册并' : ''}登录成功:`, { 
        socketId: currentUser.id,
        username: currentUser.username, 
        providedUserId: currentUser.providedUserId,
        color: currentUser.color,
        isNewUser: isNewUser
      });

      // 更新用户最后登录时间
      userAccount.lastLogin = new Date();
      userDatabase.set(userAccount.normalizedUsername, userAccount);

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
        newUsername: currentUser.username,
        totalUsers: userJoinedData.users.length 
      });
      
      socket.to(roomId).emit('user_joined', userJoinedData);

      console.log(`✅ 用户 ${currentUser.username} (IP: ${clientIP}) 成功${isNewUser ? '注册并' : ''}加入房间 ${roomId}`);
    } catch (error) {
      console.error('❌ 加入房间错误:', error);
      socket.emit('error', { message: '登录失败: ' + error.message });
    }
  });

  // 开始绘画
  socket.on('drawing_start', async ({ roomId, path }) => {
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

      // 立即保存到文件
      await saveRoomsDatabase();

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
  socket.on('drawing_update', async ({ roomId, pathId, points }) => {
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
  socket.on('drawing_end', async ({ roomId, pathId }) => {
    try {
      if (!currentUser || currentRoomId !== roomId) {
        return;
      }

      // 保存到文件
      await saveRoomsDatabase();

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
  socket.on('clear_my_drawings', async ({ roomId }) => {
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

      // 立即保存到文件
      await saveRoomsDatabase();

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
  socket.on('update_username', async ({ username }) => {
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

      const normalizedNewUsername = username.toLowerCase();
      
      // 检查新用户名是否已被其他用户使用
      if (userDatabase.has(normalizedNewUsername) && normalizedNewUsername !== currentUser.normalizedUsername) {
        socket.emit('error', { message: '用户名已被其他用户使用，请选择其他用户名' });
        return;
      }

      // 检查房间内是否有其他用户使用相同用户名
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          const existingUser = Array.from(room.users.values()).find(
            user => user.username.toLowerCase() === normalizedNewUsername && user.id !== socket.id
          );
          if (existingUser) {
            socket.emit('error', { message: '房间内已有用户使用该用户名，请选择其他用户名' });
            return;
          }
        }
      }

      const oldUsername = currentUser.username;
      const oldNormalizedUsername = currentUser.normalizedUsername;
      
      // 更新数据库中的用户信息
      if (userDatabase.has(oldNormalizedUsername)) {
        const userAccount = userDatabase.get(oldNormalizedUsername);
        userAccount.username = username.trim();
        userAccount.normalizedUsername = normalizedNewUsername;
        
        // 如果用户名发生变化，需要更新数据库键
        if (oldNormalizedUsername !== normalizedNewUsername) {
          userDatabase.delete(oldNormalizedUsername);
          userDatabase.set(normalizedNewUsername, userAccount);
        }
        
        await saveUserDatabase();
      }

      // 更新当前用户信息
      currentUser.username = username.trim();
      currentUser.normalizedUsername = normalizedNewUsername;
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
  socket.on('disconnect', async () => {
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

        // 如果房间为空，保留房间和绘画数据
        if (room.users.size === 0) {
          console.log(`房间 ${currentRoomId} 已空，保留绘画数据`);
          // 保存房间数据
          await saveRoomsDatabase();
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
    totalUsers: Array.from(rooms.values()).reduce((sum, room) => sum + room.users.size, 0),
    registeredUsers: userDatabase.size,
    totalDrawings: Array.from(rooms.values()).reduce((sum, room) => sum + room.drawingPaths.length, 0)
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

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.log('\n🛑 收到关闭信号，正在保存数据...');
  await saveUserDatabase();
  await saveRoomsDatabase();
  console.log('💾 数据保存完成，服务器关闭');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 收到终止信号，正在保存数据...');
  await saveUserDatabase();
  await saveRoomsDatabase();
  console.log('💾 数据保存完成，服务器关闭');
  process.exit(0);
});

const PORT = process.env.PORT || 8080;

// 启动服务器
async function startServer() {
  try {
    // 确保数据目录存在
    await ensureDataDirectory();
    
    // 加载数据
    await loadUserDatabase();
    await loadRoomsDatabase();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/health`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🌐 局域网访问: http://192.168.100.171:${PORT}`);
      }
      console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📚 已注册用户: ${userDatabase.size}`);
      console.log(`🏠 已保存房间: ${rooms.size}`);
      const totalDrawings = Array.from(rooms.values()).reduce((sum, room) => sum + room.drawingPaths.length, 0);
      console.log(`🎨 已保存绘画: ${totalDrawings}`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer(); 