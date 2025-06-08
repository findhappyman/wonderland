import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User } from '../types';

interface UseSocketReturn {
  socket: Socket | null;
  users: User[];
  isConnected: boolean;
  currentUser: User | null;
  isLoggedIn: boolean;
  loginError: string | null;
  login: (userId: string, username: string, password: string) => void;
  logout: () => void;
}

export const useSocket = (): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const initializedRef = useRef(false);
  const roomStateTimeoutRef = useRef<number | null>(null);

  // 初始化Socket连接但不自动登录
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';
    console.log('🔄 初始化Socket连接到:', serverUrl);
    
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: false // 不自动连接，等待用户登录
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // 连接事件
    newSocket.on('connect', () => {
      console.log('🔗 Connected to server:', serverUrl, 'Socket ID:', newSocket.id);
      setIsConnected(true);
      setLoginError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
      setCurrentUser(null);
      setUsers([]);
      setIsLoggedIn(false);
      
      if (roomStateTimeoutRef.current) {
        window.clearTimeout(roomStateTimeoutRef.current);
        roomStateTimeoutRef.current = null;
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ 连接错误:', error);
      setLoginError('无法连接到服务器，请检查网络连接');
      setIsConnected(false);
    });

    // 房间状态更新
    newSocket.on('room_state', ({ users: roomUsers, drawingPaths }) => {
      console.log('📊 收到房间状态:', { usersCount: roomUsers.length, pathsCount: drawingPaths.length });
      
      if (roomStateTimeoutRef.current) {
        window.clearTimeout(roomStateTimeoutRef.current);
        roomStateTimeoutRef.current = null;
      }
      
      const convertedUsers = roomUsers.map((user: any) => ({
        id: user.id,
        name: user.username,
        color: user.color
      }));
      
      const currentUserData = convertedUsers.find((user: User) => user.id === newSocket.id);
      if (currentUserData) {
        setCurrentUser(currentUserData);
        setIsLoggedIn(true);
        console.log('👤 登录成功，用户信息:', currentUserData);
      } else {
        console.error('❌ 未在房间用户列表中找到当前用户');
        console.log('🔍 调试信息:', { 
          socketId: newSocket.id, 
          roomUsers: convertedUsers,
          roomUsersIds: convertedUsers.map((u: User) => u.id)
        });
      }
      
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
      
      if (userId === newSocket.id) {
        const updatedCurrentUser = convertedUsers.find((user: User) => user.id === newSocket.id);
        if (updatedCurrentUser) {
          setCurrentUser(updatedCurrentUser);
          console.log('👤 当前用户信息已更新:', updatedCurrentUser);
        }
      }
      
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
      setLoginError(message);
    });

    // 通用事件监听器
    newSocket.onAny((eventName, ...args) => {
      console.log('📡 收到Socket事件:', eventName, args);
    });

    return () => {
      console.log('🧹 清理Socket连接');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      if (roomStateTimeoutRef.current) {
        window.clearTimeout(roomStateTimeoutRef.current);
        roomStateTimeoutRef.current = null;
      }
    };
  }, []);

  // 登录函数
  const login = (userId: string, username: string, password: string) => {
    if (!socket) {
      setLoginError('Socket未初始化');
      return;
    }

    console.log('🚀 开始登录:', { userId, username, passwordLength: password.length });
    setLoginError(null);

    // 连接到服务器
    if (!socket.connected) {
      socket.connect();
    }

    // 设置登录超时
    roomStateTimeoutRef.current = window.setTimeout(() => {
      if (!isLoggedIn) {
        console.error('❌ 登录超时');
        setLoginError('登录超时，请重试');
        socket.disconnect();
      }
    }, 10000);

    // 连接成功后发送登录信息
    const handleConnectForLogin = () => {
      console.log('📡 发送登录信息到服务器...');
      socket.emit('join_room', {
        roomId: 'global',
        username: username,
        userId: userId,
        password: password
      });
    };

    if (socket.connected) {
      handleConnectForLogin();
    } else {
      socket.once('connect', handleConnectForLogin);
    }
  };

  // 登出函数
  const logout = () => {
    console.log('👋 用户登出');
    
    if (socket) {
      socket.disconnect();
    }
    
    setCurrentUser(null);
    setUsers([]);
    setIsLoggedIn(false);
    setIsConnected(false);
    setLoginError(null);
    
    if (roomStateTimeoutRef.current) {
      window.clearTimeout(roomStateTimeoutRef.current);
      roomStateTimeoutRef.current = null;
    }
  };

  return {
    socket,
    users,
    isConnected,
    currentUser,
    isLoggedIn,
    loginError,
    login,
    logout
  };
}; 