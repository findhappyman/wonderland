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
  name: string;
  color: string;
  cursor?: Point;
  isDrawing?: boolean;
}

export interface CanvasState {
  zoom: number;
  offset: Point;
  tool: 'pen' | 'pan';
  color: string;
  size: number;
  showCoordinates?: boolean;
  currentCoordinates?: Point;
}

export interface SocketEvents {
  'user-joined': (user: User) => void;
  'user-left': (userId: string) => void;
  'drawing-start': (data: { userId: string; point: Point; color: string; size: number }) => void;
  'drawing-continue': (data: { userId: string; point: Point }) => void;
  'drawing-end': (data: { userId: string; drawingData: DrawingData }) => void;
  'cursor-move': (data: { userId: string; point: Point }) => void;
  'canvas-clear': () => void;
}