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

  useEffect(() => {
    // 获取服务器URL，支持环境变量配置
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3003';
    
    // Connect to the server
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('🔗 Connected to server:', serverUrl);
      setIsConnected(true);
      
      // 确保socket.id存在才设置用户
      if (newSocket.id) {
        const userWithSocketId = {
          ...initialUser,
          id: newSocket.id
        };
        setCurrentUser(userWithSocketId);
        console.log('👤 用户信息已设置:', userWithSocketId);
      }
      
      // Join the global room with username (server expects { roomId, username })
      newSocket.emit('join_room', {
        roomId: 'global',
        username: initialUser.name
      });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
      setCurrentUser(null);
    });

    // Room state event (server sends initial room data)
    newSocket.on('room_state', (data: { users: any[], drawingPaths: any[] }) => {
      console.log('🏠 Room state received:', data);
      
      // 转换服务器用户数据格式到客户端格式
      const convertedUsers = data.users.map(serverUser => ({
        id: serverUser.id,
        name: serverUser.username,
        color: serverUser.color
      }));
      
      setUsers(convertedUsers.filter(u => u.id !== newSocket.id));
      
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
      console.log('👋 User joined:', data.user.username);
      
      // 转换服务器用户数据格式
      const convertedUsers = data.users.map(serverUser => ({
        id: serverUser.id,
        name: serverUser.username,
        color: serverUser.color
      }));
      
      setUsers(convertedUsers.filter(u => u.id !== newSocket.id));
    });

    newSocket.on('user_left', (data: { userId: string, users: any[] }) => {
      console.log('👋 User left:', data.userId);
      
      // 转换服务器用户数据格式
      const convertedUsers = data.users.map(serverUser => ({
        id: serverUser.id,
        name: serverUser.username,
        color: serverUser.color
      }));
      
      setUsers(convertedUsers.filter(u => u.id !== newSocket.id));
    });

    // Error handling
    newSocket.on('error', (error: { message: string }) => {
      console.error('❌ Socket error:', error.message);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [initialUser]);

  return {
    socket,
    users,
    isConnected,
    currentUser
  };
}; 