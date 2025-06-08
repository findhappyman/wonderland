export interface Point {
  x: number;
  y: number;
}

export interface DrawingData {
  id: string;
  points: Point[];
  color: string;
  size: number;
  userId: string;
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  color: string;
  isOnline: boolean;
  joinedAt: Date;
}

export interface DrawingPath {
  id: string;
  userId: string;
  username: string;
  points: { x: number; y: number }[];
  color: string;
  size: number;
  createdAt: Date;
}

export interface Room {
  id: string;
  users: Map<string, User>;
  drawingPaths: DrawingPath[];
  createdAt: Date;
}

export interface ServerToClientEvents {
  user_joined: (data: { user: User; users: User[] }) => void;
  user_left: (data: { userId: string; users: User[] }) => void;
  drawing_started: (data: { path: DrawingPath }) => void;
  drawing_updated: (data: { pathId: string; points: { x: number; y: number }[] }) => void;
  drawing_ended: (data: { pathId: string }) => void;
  cursor_moved: (data: { userId: string; x: number; y: number }) => void;
  room_state: (data: { users: User[]; drawingPaths: DrawingPath[] }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  join_room: (data: { roomId: string; username: string }) => void;
  leave_room: (data: { roomId: string }) => void;
  drawing_start: (data: { roomId: string; path: Omit<DrawingPath, 'id' | 'userId' | 'username' | 'createdAt'> }) => void;
  drawing_update: (data: { roomId: string; pathId: string; points: { x: number; y: number }[] }) => void;
  drawing_end: (data: { roomId: string; pathId: string }) => void;
  cursor_move: (data: { roomId: string; x: number; y: number }) => void;
} 