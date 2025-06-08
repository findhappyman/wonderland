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
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
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
      
      // Join the global room with username (server expects { roomId, username })
      newSocket.emit('join_room', {
        roomId: 'global',
        username: initialUser.name
      });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    // Room state event (server sends initial room data)
    newSocket.on('room_state', (data: { users: User[], drawingPaths: any[] }) => {
      console.log('🏠 Room state received:', data);
      setUsers(data.users.filter(u => u.id !== newSocket.id));
      // Update current user with server data if available
      const serverUser = data.users.find(u => u.id === newSocket.id);
      if (serverUser) {
        setCurrentUser(serverUser);
      }
    });

    // User management events
    newSocket.on('user_joined', (data: { user: User, users: User[] }) => {
      console.log('👋 User joined:', data.user.name);
      setUsers(data.users.filter(u => u.id !== newSocket.id));
    });

    newSocket.on('user_left', (data: { userId: string, users: User[] }) => {
      console.log('👋 User left:', data.userId);
      setUsers(data.users.filter(u => u.id !== newSocket.id));
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