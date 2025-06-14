import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface DrawingPath {
  id: string;
  userId: string;
  points: Array<{ x: number; y: number; pressure?: number }>;
  color: string;
  width: number;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  color: string;
  providedUserId: string;
  isOnline: boolean;
}

// 本地存储键名
const STORAGE_KEYS = {
  USER_CREDENTIALS: 'wonderland_user_credentials',
  LOGIN_STATE: 'wonderland_login_state'
};

// 用户凭据接口
interface StoredCredentials {
  userId: string;
  username: string;
  password: string;
  roomId: string;
  loginTime: number;
}

// 登录状态接口
interface LoginState {
  isLoggedIn: boolean;
  user?: User;
}

export interface UseSocketReturn {
  isConnected: boolean;
  isLoggedIn: boolean;
  currentUser: User | null;
  users: User[];
  drawingPaths: DrawingPath[];
  loginError: string | null;
  isAutoLoginAttempting: boolean;
  login: (userId: string, username: string, password: string, roomId?: string) => Promise<void>;
  logout: () => void;
  attemptAutoLogin: () => Promise<boolean>;
  updateUsername: (newUsername: string) => void;
  sendDrawing: (pathData: any) => void;
  updateDrawing: (pathId: string, points: any[]) => void;
  endDrawing: (pathId: string) => void;
  clearMyDrawings: () => void;
}

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const roomStateTimeoutRef = useRef<number | null>(null);
  const [isAutoLoginAttempting, setIsAutoLoginAttempting] = useState(false);
  const pendingLoginResolveRef = useRef<(() => void) | null>(null);
  const pendingLoginRejectRef = useRef<((error: Error) => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // 从本地存储获取用户凭据
  const getStoredCredentials = useCallback((): StoredCredentials | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER_CREDENTIALS);
      if (!stored) return null;
      
      const credentials: StoredCredentials = JSON.parse(stored);
      
      // 检查是否过期（24小时）
      const now = Date.now();
      const loginAge = now - credentials.loginTime;
      const maxAge = 24 * 60 * 60 * 1000; // 24小时
      
      if (loginAge > maxAge) {
        localStorage.removeItem(STORAGE_KEYS.USER_CREDENTIALS);
        localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
        return null;
      }
      
      return credentials;
    } catch (error) {
      console.error('获取存储凭据失败:', error);
      return null;
    }
  }, []);

  // 保存用户凭据到本地存储
  const saveCredentials = useCallback((userId: string, username: string, password: string, roomId: string) => {
    try {
      const credentials: StoredCredentials = {
        userId,
        username,
        password,
        roomId,
        loginTime: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEYS.USER_CREDENTIALS, JSON.stringify(credentials));
      
      console.log('💾 用户凭据已保存到本地存储');
    } catch (error) {
      console.error('保存凭据失败:', error);
    }
  }, []);

  // 保存登录状态
  const saveLoginState = useCallback((user: User) => {
    try {
      const loginState: LoginState = {
        isLoggedIn: true,
        user
      };
      
      localStorage.setItem(STORAGE_KEYS.LOGIN_STATE, JSON.stringify(loginState));
    } catch (error) {
      console.error('保存登录状态失败:', error);
    }
  }, []);

  // 清除本地存储
  const clearStoredData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.USER_CREDENTIALS);
    localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
    console.log('🧹 已清除本地存储的用户数据');
  }, []);

  // 初始化Socket连接的函数
  const initializeSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('⚠️ Socket已存在，跳过初始化');
      return;
    }

    // 动态选择服务器地址：生产环境使用环境变量，开发环境使用本地服务器
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';
    console.log('🔄 初始化Socket连接到:', serverUrl);
    console.log('🔧 环境变量 VITE_SERVER_URL:', import.meta.env.VITE_SERVER_URL);
    console.log('🌐 当前页面地址:', window.location.href);
    
    const newSocket = io(serverUrl, {
      // 云端部署优化配置
      transports: ['polling', 'websocket'], // 先使用polling，再升级到websocket
      autoConnect: true,
      timeout: 30000, // 增加超时时间
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false,
      // 重连配置
      reconnection: true,
      reconnectionAttempts: 10, // 增加重连次数
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      // 云端部署特殊配置
      withCredentials: true,
      // 增加握手超时
      handshakeTimeout: 20000,
      // 增加心跳配置
      heartbeatTimeout: 20000,
      heartbeatInterval: 15000
    });

    socketRef.current = newSocket;

    // 连接事件
    newSocket.on('connect', () => {
      console.log('🔗 Connected to server:', serverUrl, 'Socket ID:', newSocket.id);
      setIsConnected(true);
      setLoginError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server, reason:', reason);
      setIsConnected(false);
      setCurrentUser(null);
      setUsers([]);
      setIsLoggedIn(false);
      
      if (roomStateTimeoutRef.current) {
        clearTimeout(roomStateTimeoutRef.current);
        roomStateTimeoutRef.current = null;
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ 连接错误:', error);
      console.error('❌ 错误详情:', { 
        message: error.message, 
        type: (error as any).type, 
        description: (error as any).description,
        context: (error as any).context,
        transportError: (error as any).transportError 
      });
      setLoginError(`无法连接到服务器: ${error.message || '网络连接错误'}`);
      setIsConnected(false);
    });

    // 添加重连事件监听
    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 重新连接成功，尝试次数:', attemptNumber);
      setIsConnected(true);
      setLoginError(null);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ 重连失败:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ 重连彻底失败');
      setLoginError('无法连接到服务器，请检查网络连接后刷新页面');
    });

    // 房间状态更新 - 这是登录成功的标志
    newSocket.on('room_state', ({ users: roomUsers, drawingPaths }) => {
      console.log('📊 收到房间状态:', { usersCount: roomUsers.length, pathsCount: drawingPaths.length });
      
      if (roomStateTimeoutRef.current) {
        clearTimeout(roomStateTimeoutRef.current);
        roomStateTimeoutRef.current = null;
      }
      
      const convertedUsers = roomUsers.map((user: any) => ({
        id: user.id,
        name: user.username,
        username: user.username,
        color: user.color,
        providedUserId: user.providedUserId || user.id,
        isOnline: true
      }));
      
      const currentUserData = convertedUsers.find((user: User) => user.id === newSocket.id);
      if (currentUserData) {
        setCurrentUser(currentUserData);
        setIsLoggedIn(true);
        setLoginError(null);
        console.log('👤 登录成功，用户信息:', currentUserData);
        
        // 如果有pending的登录promise，resolve它
        if (pendingLoginResolveRef.current) {
          pendingLoginResolveRef.current();
          pendingLoginResolveRef.current = null;
          pendingLoginRejectRef.current = null;
        }
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
      setDrawingPaths(drawingPaths);
      console.log('👥 其他用户列表已更新:', otherUsers);
    });

    // 用户加入
    newSocket.on('user_joined', ({ user, users: roomUsers }) => {
      console.log('👋 用户加入:', user);
      
      const convertedUsers = roomUsers.map((user: any) => ({
        id: user.id,
        name: user.username,
        username: user.username,
        color: user.color,
        providedUserId: user.providedUserId || user.id,
        isOnline: true
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
        username: user.username,
        color: user.color,
        providedUserId: user.providedUserId || user.id,
        isOnline: true
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
        username: user.username,
        color: user.color,
        providedUserId: user.providedUserId || user.id,
        isOnline: true
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
      
      // 如果有pending的登录promise，reject它
      if (pendingLoginRejectRef.current) {
        pendingLoginRejectRef.current(new Error(message));
        pendingLoginResolveRef.current = null;
        pendingLoginRejectRef.current = null;
      }
    });

    // 绘画事件处理
    newSocket.on('drawing_started', ({ path }) => {
      console.log('📡 收到新绘画开始:', path);
      setDrawingPaths(prev => [...prev, path]);
    });

    newSocket.on('drawing_updated', ({ pathId, points }) => {
      console.log('📡 收到绘画更新:', { pathId, pointsCount: points.length });
      setDrawingPaths(prev => 
        prev.map(path => 
          path.id === pathId ? { ...path, points } : path
        )
      );
    });

    newSocket.on('drawing_ended', ({ pathId }) => {
      console.log('📡 收到绘画结束:', pathId);
    });

    newSocket.on('drawings_cleared', ({ userId, deletedPathIds }) => {
      console.log('📡 收到绘画清空:', { userId, deletedPathIds });
      setDrawingPaths(prev => 
        prev.filter(path => !deletedPathIds.includes(path.id))
      );
    });

    // 通用事件监听器
    newSocket.onAny((eventName, ...args) => {
      console.log('📡 收到Socket事件:', eventName, args);
    });

    // 设置清理函数
    cleanupRef.current = () => {
      console.log('🧹 清理Socket连接');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      if (roomStateTimeoutRef.current) {
        clearTimeout(roomStateTimeoutRef.current);
        roomStateTimeoutRef.current = null;
      }
    };

    console.log('✅ Socket初始化完成');
  }, []);

  // 初始化Socket连接
  useEffect(() => {
    if (initializedRef.current) {
      console.log('⚠️ Socket已初始化，跳过重复初始化');
      return;
    }
    
    initializedRef.current = true;
    console.log('🚀 开始初始化Socket...');
    
    initializeSocket();

    // 清理函数
    return () => {
      console.log('🧹 useEffect清理函数被调用');
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      initializedRef.current = false;
    };
  }, [initializeSocket]);

  // 手动登录函数
  const login = useCallback((userId: string, username: string, password: string, roomId: string = 'main') => {
    return new Promise<void>((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket未初始化'));
        return;
      }

      if (!socketRef.current.connected) {
        console.log('⚠️ Socket未连接，等待连接后重试...');
        
        // 等待Socket连接
        const connectTimeout = setTimeout(() => {
          reject(new Error('Socket连接超时，请检查服务器状态'));
        }, 15000);

        const onConnect = () => {
          clearTimeout(connectTimeout);
          socketRef.current?.off('connect', onConnect);
          
          // 连接成功后继续登录流程
          performLogin();
        };

        socketRef.current.on('connect', onConnect);
        
        // 如果Socket未连接，尝试手动连接
        if (!socketRef.current.connected && !socketRef.current.disconnected) {
          socketRef.current.connect();
        }
        
        return;
      }

      // Socket已连接，直接执行登录
      performLogin();

      function performLogin() {
        if (!socketRef.current) {
          reject(new Error('Socket未初始化'));
          return;
        }

        console.log('📡 发送登录请求...', { userId, username, roomId });

        // 清除之前的超时
        if (roomStateTimeoutRef.current) {
          clearTimeout(roomStateTimeoutRef.current);
          roomStateTimeoutRef.current = null;
        }

        // 设置登录promise引用
        pendingLoginResolveRef.current = () => {
          // 保存凭据和登录状态到本地存储
          saveCredentials(userId, username, password, roomId);
          if (currentUser) {
            saveLoginState(currentUser);
          }
          resolve();
        };
        pendingLoginRejectRef.current = reject;

        // 设置10秒超时
        const timeout = window.setTimeout(() => {
          setLoginError('登录超时，请检查网络连接或稍后再试');
          pendingLoginResolveRef.current = null;
          pendingLoginRejectRef.current = null;
          reject(new Error('登录超时'));
        }, 10000);
        roomStateTimeoutRef.current = timeout;

        // 监听错误响应
        const handleLoginError = (error: { message: string }) => {
          clearTimeout(timeout);
          roomStateTimeoutRef.current = null;
          console.error('❌ 登录错误:', error.message);
          setLoginError(error.message);
          pendingLoginResolveRef.current = null;
          pendingLoginRejectRef.current = null;
          reject(new Error(error.message));
        };

        // 注册一次性错误监听器
        socketRef.current.once('error', handleLoginError);

        // 发送join_room请求（不是login）
        socketRef.current.emit('join_room', { 
          roomId, 
          username, 
          userId, 
          password 
        });
      }
    });
  }, [saveCredentials, saveLoginState, currentUser]);

  // 自动登录函数
  const attemptAutoLogin = useCallback(() => {
    const credentials = getStoredCredentials();
    if (!credentials || isAutoLoginAttempting) {
      return Promise.resolve(false);
    }

    console.log('🔄 尝试自动登录...', { username: credentials.username });
    setIsAutoLoginAttempting(true);
    
    return login(credentials.userId, credentials.username, credentials.password, credentials.roomId)
      .then(() => {
        console.log('✅ 自动登录成功');
        setIsAutoLoginAttempting(false);
        return true;
      })
      .catch((error) => {
        console.log('❌ 自动登录失败:', error.message);
        // 如果自动登录失败，清除存储的凭据
        clearStoredData();
        setIsAutoLoginAttempting(false);
        return false;
      });
  }, [getStoredCredentials, isAutoLoginAttempting, login, clearStoredData]);

  // 登出函数
  const logout = useCallback(() => {
    console.log('👋 用户登出');
    
    // 清除超时
    if (roomStateTimeoutRef.current) {
      clearTimeout(roomStateTimeoutRef.current);
      roomStateTimeoutRef.current = null;
    }
    
    // 发送登出事件
    if (socketRef.current && isConnected) {
      socketRef.current.emit('logout');
    }
    
    // 重置状态
    setIsLoggedIn(false);
    setCurrentUser(null);
    setUsers([]);
    setDrawingPaths([]);
    setLoginError(null);
    
    // 清除本地存储
    clearStoredData();
  }, [isConnected, clearStoredData]);

  // 页面加载时尝试自动登录
  useEffect(() => {
    if (isConnected && !isLoggedIn && !isAutoLoginAttempting) {
      attemptAutoLogin();
    }
  }, [isConnected, isLoggedIn, isAutoLoginAttempting, attemptAutoLogin]);

  // 更新用户名
  const updateUsername = useCallback((newUsername: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('update_username', { username: newUsername });
    }
  }, [isConnected]);

  // 发送绘画数据
  const sendDrawing = useCallback((pathData: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('drawing_start', pathData);
    }
  }, [isConnected]);

  // 更新绘画
  const updateDrawing = useCallback((pathId: string, points: any[]) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('drawing_update', { 
        roomId: 'main',
        pathId, 
        points 
      });
    }
  }, [isConnected]);

  // 结束绘画
  const endDrawing = useCallback((pathId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('drawing_end', { 
        roomId: 'main',
        pathId 
      });
    }
  }, [isConnected]);

  // 清空我的绘画
  const clearMyDrawings = useCallback(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('clear_my_drawings', { roomId: 'main' });
    }
  }, [isConnected]);

  return {
    isConnected,
    currentUser,
    users,
    drawingPaths,
    isLoggedIn,
    loginError,
    isAutoLoginAttempting,
    login,
    logout,
    attemptAutoLogin,
    updateUsername,
    sendDrawing,
    updateDrawing,
    endDrawing,
    clearMyDrawings
  };
}; 