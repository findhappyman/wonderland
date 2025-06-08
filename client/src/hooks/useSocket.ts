import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User } from '../types';

interface UseSocketReturn {
  socket: Socket | null;
  users: User[];
  isConnected: boolean;
  currentUser: User | null;
}

export const useSocket = (): UseSocketReturn => {
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
      
      // 服务器会自动基于IP分配用户身份，不需要手动加入房间
      console.log('⏳ 等待服务器分配用户身份...');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
      setCurrentUser(null);
      setUsers([]);
    });

    // 房间状态更新
    newSocket.on('room_state', ({ users: roomUsers, drawingPaths }) => {
      console.log('📊 收到房间状态:', { usersCount: roomUsers.length, pathsCount: drawingPaths.length });
      
      // 转换用户数据格式
      const convertedUsers = roomUsers.map((user: any) => ({
        id: user.id,
        name: user.username,
        color: user.color
      }));
      
      // 找到当前用户
      const currentUserData = convertedUsers.find((user: User) => user.id === newSocket.id);
      if (currentUserData) {
        setCurrentUser(currentUserData);
        console.log('👤 当前用户信息已设置:', currentUserData);
      }
      
      // 设置其他用户列表（不包含当前用户）
      const otherUsers = convertedUsers.filter((user: User) => user.id !== newSocket.id);
      setUsers(otherUsers);
      console.log('👥 其他用户列表已更新:', otherUsers);
    });

    // 用户加入
    newSocket.on('user_joined', ({ user, users: roomUsers }) => {
      console.log('👋 用户加入:', user);
      
      const convertedUsers = roomUsers.map((user: any) => ({
        id: user.id,
        name: user.username,
        color: user.color
      }));
      
      // 更新用户列表（不包含当前用户）
      const otherUsers = convertedUsers.filter((user: User) => user.id !== newSocket.id);
      setUsers(otherUsers);
    });

    // 用户离开
    newSocket.on('user_left', ({ userId, users: roomUsers }) => {
      console.log('👋 用户离开:', userId);
      
      const convertedUsers = roomUsers.map((user: any) => ({
        id: user.id,
        name: user.username,
        color: user.color
      }));
      
      // 更新用户列表（不包含当前用户）
      const otherUsers = convertedUsers.filter((user: User) => user.id !== newSocket.id);
      setUsers(otherUsers);
    });

    // 用户信息更新
    newSocket.on('user_updated', ({ userId, username, users: roomUsers }) => {
      console.log('🔄 用户信息更新:', { userId, username });
      
      const convertedUsers = roomUsers.map((user: any) => ({
        id: user.id,
        name: user.username,
        color: user.color
      }));
      
      // 如果是当前用户，更新当前用户信息
      if (userId === newSocket.id) {
        const updatedCurrentUser = convertedUsers.find((user: User) => user.id === newSocket.id);
        if (updatedCurrentUser) {
          setCurrentUser(updatedCurrentUser);
          console.log('👤 当前用户信息已更新:', updatedCurrentUser);
        }
      }
      
      // 更新用户列表（不包含当前用户）
      const otherUsers = convertedUsers.filter((user: User) => user.id !== newSocket.id);
      setUsers(otherUsers);
    });

    // 用户名更新确认
    newSocket.on('username_updated', ({ username, oldUsername }) => {
      console.log('✅ 用户名更新成功:', { oldUsername, newUsername: username });
    });

    // 错误处理
    newSocket.on('error', ({ message }) => {
      console.error('❌ Socket错误:', message);
      alert(`错误: ${message}`);
    });

    // 通用事件监听器（用于调试）
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
  }, []); // 移除依赖项，只初始化一次

  return {
    socket,
    users,
    isConnected,
    currentUser
  };
}; 