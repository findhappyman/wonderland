import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User } from '../types';

interface UseSocketReturn {
  socket: Socket | null;
  users: User[];
  isConnected: boolean;
  currentUser: User | null;
}

export const useSocket = (initialUser: User): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // 避免重复初始化
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // 获取服务器URL，支持环境变量配置
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3003';
    
    console.log('🔄 初始化Socket连接到:', serverUrl);
    
    // Connect to the server
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('🔗 Connected to server:', serverUrl, 'Socket ID:', newSocket.id);
      setIsConnected(true);
      
      // 确保socket.id存在才设置用户
      if (newSocket.id) {
        const userWithSocketId = {
          ...initialUser,
          id: newSocket.id
        };
        setCurrentUser(userWithSocketId);
        console.log('👤 用户信息已设置:', userWithSocketId);
        
        // Join the global room with username (server expects { roomId, username })
        console.log('📡 发送join_room事件:', { roomId: 'global', username: initialUser.name });
        newSocket.emit('join_room', {
          roomId: 'global',
          username: initialUser.name
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
      setCurrentUser(null);
      setUsers([]);
    });

    // Room state event (server sends initial room data)
    newSocket.on('room_state', (data: { users: any[], drawingPaths: any[] }) => {
      console.log('🏠 Room state received:', data);
      console.log('📊 用户数据:', data.users);
      
      // 转换服务器用户数据格式到客户端格式
      const convertedUsers = data.users.map(serverUser => ({
        id: serverUser.id,
        name: serverUser.username,
        color: serverUser.color
      }));
      
      console.log('🔄 转换后的用户数据:', convertedUsers);
      
      // 过滤掉当前用户，只保留其他用户
      const otherUsers = convertedUsers.filter(u => u.id !== newSocket.id);
      console.log('👥 其他用户列表:', otherUsers);
      setUsers(otherUsers);
      
      // 更新当前用户信息
      const serverUser = data.users.find(u => u.id === newSocket.id);
      if (serverUser) {
        const convertedCurrentUser = {
          id: serverUser.id,
          name: serverUser.username,
          color: serverUser.color
        };
        setCurrentUser(convertedCurrentUser);
        console.log('✅ 当前用户已同步:', convertedCurrentUser);
      }
    });

    // User management events
    newSocket.on('user_joined', (data: { user: any, users: any[] }) => {
      console.log('👋 User joined event received:', data);
      console.log('📊 新的用户列表:', data.users);
      
      // 转换服务器用户数据格式
      const convertedUsers = data.users.map(serverUser => ({
        id: serverUser.id,
        name: serverUser.username,
        color: serverUser.color
      }));
      
      console.log('🔄 转换后的用户数据:', convertedUsers);
      
      // 过滤掉当前用户，只保留其他用户
      const otherUsers = convertedUsers.filter(u => u.id !== newSocket.id);
      console.log('👥 更新后的其他用户列表:', otherUsers);
      setUsers(otherUsers);
    });

    newSocket.on('user_left', (data: { userId: string, users: any[] }) => {
      console.log('👋 User left event received:', data);
      console.log('📊 剩余用户列表:', data.users);
      
      // 转换服务器用户数据格式
      const convertedUsers = data.users.map(serverUser => ({
        id: serverUser.id,
        name: serverUser.username,
        color: serverUser.color
      }));
      
      console.log('🔄 转换后的用户数据:', convertedUsers);
      
      // 过滤掉当前用户，只保留其他用户
      const otherUsers = convertedUsers.filter(u => u.id !== newSocket.id);
      console.log('👥 更新后的其他用户列表:', otherUsers);
      setUsers(otherUsers);
    });

    // Error handling
    newSocket.on('error', (error: { message: string }) => {
      console.error('❌ Socket error:', error.message);
    });

    // 添加通用事件监听器来调试
    newSocket.onAny((eventName, ...args) => {
      console.log('📡 收到Socket事件:', eventName, args);
    });

    // Cleanup on unmount
    return () => {
      console.log('🧹 清理Socket连接');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [initialUser]); // 恢复依赖项，但有初始化保护

  return {
    socket,
    users,
    isConnected,
    currentUser
  };
}; 