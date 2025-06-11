import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { CanvasState, User, Point } from '../types';
import { generateRandomInitialPosition } from '../utils/user';

interface DrawingPath {
  id: string;
  userId: string;
  points: Point[];
  color: string;
  width: number;
  createdAt: string;
}

interface InfiniteCanvasProps {
  canvasState: CanvasState;
  onStateChange: (newState: Partial<CanvasState>) => void;
  currentUser: User;
  users: User[];
  drawingPaths: DrawingPath[];
  // Socket functions
  sendDrawing: (pathData: any) => void;
  updateDrawing: (pathId: string, points: any[]) => void;
  endDrawing: (pathId: string) => void;
  clearMyDrawings: () => void;
  // Drawing event handlers
  onDrawingStarted?: (path: DrawingPath) => void;
  onDrawingUpdated?: (pathId: string, points: Point[]) => void;
  onDrawingEnded?: (pathId: string) => void;
  onDrawingsCleared?: (userId: string, deletedPathIds: string[]) => void;
}

export interface InfiniteCanvasRef {
  clearMyDrawings: () => void;
}

const InfiniteCanvas = forwardRef<InfiniteCanvasRef, InfiniteCanvasProps>(({
  canvasState,
  onStateChange,
  currentUser,
  users,
  drawingPaths,
  sendDrawing,
  updateDrawing,
  endDrawing,
  clearMyDrawings,
  onDrawingStarted,
  onDrawingUpdated,
  onDrawingEnded,
  onDrawingsCleared
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);
  const [currentPathId, setCurrentPathId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
  const [hasInitialized, setHasInitialized] = useState(false);

  const lastPointRef = useRef<Point | null>(null);
  const lastPanPointRef = useRef<Point | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDrawingUpdateRef = useRef<number>(0);
  const redrawTimeoutRef = useRef<number | null>(null);

  const { zoom, offset, tool, color, size, showCoordinates } = canvasState;

  // 清空我的绘画
  const handleClearMyDrawings = useCallback(() => {
    clearMyDrawings();
  }, [clearMyDrawings]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    clearMyDrawings: handleClearMyDrawings
  }), [handleClearMyDrawings]);

  // 初始化随机位置（只在第一次加载时执行）
  useEffect(() => {
    if (!hasInitialized) {
      const randomPosition = generateRandomInitialPosition();
      onStateChange({ offset: randomPosition });
      setHasInitialized(true);
      console.log('🎯 随机传送到坐标:', randomPosition);
    }
  }, [hasInitialized, onStateChange]);

  // 获取画布坐标（考虑缩放和偏移）
  const getCanvasCoordinates = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - offset.x) / zoom;
    const y = (clientY - rect.top - offset.y) / zoom;
    return { x, y };
  }, [zoom, offset]);

  // 应用变换到画布上下文
  const applyTransform = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(zoom, 0, 0, zoom, offset.x, offset.y);
  }, [zoom, offset]);

  // 绘制单条路径
  const drawPath = useCallback((ctx: CanvasRenderingContext2D, path: DrawingPath) => {
    if (path.points.length < 1) return;

    ctx.save();
    applyTransform(ctx);
    
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.width / zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over'; // 确保正常绘制模式
    
    ctx.beginPath();
    
    if (path.points.length === 1) {
      // 单点绘制为小圆圈
      const point = path.points[0];
      ctx.fillStyle = path.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, path.width / zoom / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (path.points.length === 2) {
      // 两点绘制为直线
      ctx.moveTo(path.points[0].x, path.points[0].y);
      ctx.lineTo(path.points[1].x, path.points[1].y);
      ctx.stroke();
    } else {
      // 多点绘制为平滑曲线
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      // 使用二次贝塞尔曲线创建平滑路径
      for (let i = 1; i < path.points.length - 1; i++) {
        const currentPoint = path.points[i];
        const nextPoint = path.points[i + 1];
        const midX = (currentPoint.x + nextPoint.x) / 2;
        const midY = (currentPoint.y + nextPoint.y) / 2;
        
        ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, midX, midY);
      }
      
      // 绘制到最后一个点
      const lastPoint = path.points[path.points.length - 1];
      const secondLastPoint = path.points[path.points.length - 2];
      ctx.quadraticCurveTo(secondLastPoint.x, secondLastPoint.y, lastPoint.x, lastPoint.y);
      ctx.stroke();
    }
    
    ctx.restore();
  }, [zoom, applyTransform]);

  // 重绘画布
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制网格背景
    ctx.save();
    applyTransform(ctx);
    
    // 绘制网格
    const gridSize = 50;
    const startX = Math.floor(-offset.x / zoom / gridSize) * gridSize;
    const startY = Math.floor(-offset.y / zoom / gridSize) * gridSize;
    const endX = startX + (canvas.width / zoom) + gridSize;
    const endY = startY + (canvas.height / zoom) + gridSize;

    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
    ctx.restore();

    // 重绘所有保存的路径
    drawingPaths.forEach(path => {
      drawPath(ctx, path);
    });

    // 绘制当前正在绘制的路径
    if (currentPath) {
      drawPath(ctx, currentPath);
    }

    // 绘制坐标信息
    if (showCoordinates) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // 绘制当前鼠标位置的坐标
      const canvasCoords = getCanvasCoordinates(mousePosition.x, mousePosition.y);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(10, canvas.height - 60, 200, 50);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.fillText(`鼠标位置: (${Math.round(canvasCoords.x)}, ${Math.round(canvasCoords.y)})`, 15, canvas.height - 40);
      ctx.fillText(`视图偏移: (${Math.round(-offset.x)}, ${Math.round(-offset.y)})`, 15, canvas.height - 25);
      ctx.fillText(`缩放: ${Math.round(zoom * 100)}%`, 15, canvas.height - 10);
      
      ctx.restore();
    }
  }, [zoom, offset, applyTransform, drawingPaths, currentPath, drawPath, showCoordinates, mousePosition, getCanvasCoordinates]);

  // 绘画更新函数
  const updateDrawingPath = useCallback((coords: Point) => {
    if (!currentPath) return;
    
    const updatedPoints = [...currentPath.points, coords];
    setCurrentPath(prev => prev ? { ...prev, points: updatedPoints } : null);
    
    // 发送更新到服务器
    if (currentPath.id) {
      updateDrawing(currentPath.id, updatedPoints);
    }
  }, [currentPath, updateDrawing]);

  // 处理鼠标移动（更新坐标显示）
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // 更新鼠标位置用于坐标显示
    setMousePosition({ x: canvasX, y: canvasY });
    
    // 更新当前坐标到状态中
    const canvasCoords = getCanvasCoordinates(e.clientX, e.clientY);
    onStateChange({ currentCoordinates: canvasCoords });

    if (isPanning && lastPanPointRef.current) {
      // 平移画布
      const deltaX = canvasX - lastPanPointRef.current.x;
      const deltaY = canvasY - lastPanPointRef.current.y;
      
      onStateChange({
        offset: {
          x: offset.x + deltaX,
          y: offset.y + deltaY
        }
      });
      
      lastPanPointRef.current = { x: canvasX, y: canvasY };
    } else if (isDrawing && lastPointRef.current && currentPath) {
      // 绘画 - 使用节流更新
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      
      // 检查距离，避免过于密集的点
      const distance = Math.sqrt(
        Math.pow(coords.x - lastPointRef.current.x, 2) + 
        Math.pow(coords.y - lastPointRef.current.y, 2)
      );
      
      if (distance > 2) { // 最小距离阈值
        console.log('🎨 鼠标移动触发绘画更新:', { coords, distance, currentPathId: currentPath?.id });
        updateDrawingPath(coords);
        lastPointRef.current = coords;
      }
    }
  }, [isPanning, isDrawing, getCanvasCoordinates, currentPath, offset, onStateChange, updateDrawingPath]);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!currentUser) {
      console.log('⚠️ 无法开始绘画 - 用户未认证:', { currentUser: !!currentUser });
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    console.log('鼠标按下:', { 
      tool, 
      button: e.button, 
      ctrlKey: e.ctrlKey, 
      metaKey: e.metaKey,
      clientX: e.clientX,
      clientY: e.clientY,
      canvasX,
      canvasY,
      currentUserId: currentUser.id
    });

    if (tool === 'pan' || e.button === 2 || e.ctrlKey || e.metaKey) {
      // 平移模式
      setIsPanning(true);
      lastPanPointRef.current = { x: canvasX, y: canvasY };
      canvas.style.cursor = 'grabbing';
    } else if (tool === 'pen' && e.button === 0) { // 确保是左键点击
      // 绘画模式
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      console.log('开始绘画:', { coords, color, size, isDrawing, userId: currentUser.id });
      
      if (!isDrawing) { // 防止重复开始绘画
        setIsDrawing(true);
        lastPointRef.current = coords;

        // 创建新的绘画路径
        const newPath: DrawingPath = {
          id: '',
          userId: currentUser.id,
          points: [coords],
          color: color,
          width: size,
          createdAt: new Date().toISOString()
        };
        setCurrentPath(newPath);
        console.log('创建新路径:', newPath);

        // 发送到服务器
        sendDrawing({
          roomId: 'main',
          path: {
            points: [coords],
            color: color,
            size: size
          }
        });
        
        console.log('📡 已发送绘画开始请求到服务器');
      }
    }
  }, [tool, color, size, getCanvasCoordinates, sendDrawing, currentUser, isDrawing]);

  // 处理鼠标抬起
  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanning) {
      setIsPanning(false);
      lastPanPointRef.current = null;
      canvas.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
    }
    
    if (isDrawing && currentPath) {
      console.log('🏁 结束绘画:', { 
        pathId: currentPath.id, 
        hasId: !!currentPath.id,
        pointsCount: currentPath.points.length 
      });
      
      // 完成当前路径 - 只有当路径有ID时才发送结束事件
      if (currentPath.id) {
        console.log('📡 发送drawing_end事件:', currentPath.id);
        endDrawing(currentPath.id);
        
        // 立即将当前路径移动到drawingPaths中，不等待服务器响应
        console.log('✅ 立即保存路径到drawingPaths:', currentPath);
        if (onDrawingEnded) {
          onDrawingEnded(currentPath.id);
        }
      } else {
        console.log('⚠️ 路径没有ID，无法发送结束事件');
      }
      
      // 清空当前绘画状态
      setCurrentPath(null);
      setCurrentPathId(null);
      setIsDrawing(false);
      lastPointRef.current = null;
    }
  }, [isPanning, isDrawing, tool, currentPath, endDrawing, onDrawingEnded]);

  // 添加触摸事件处理
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        ctrlKey: false,
        metaKey: false,
        preventDefault: () => {}
      } as React.MouseEvent<HTMLCanvasElement>;
      handleMouseDown(mouseEvent);
    }
  }, [handleMouseDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {}
      } as React.MouseEvent<HTMLCanvasElement>;
      handleMouseMove(mouseEvent);
    }
  }, [handleMouseMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp();
  }, [handleMouseUp]);

  // 处理滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));

    // 以鼠标位置为中心缩放
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomRatio = newZoom / zoom;
    onStateChange({
      zoom: newZoom,
      offset: {
        x: mouseX - (mouseX - offset.x) * zoomRatio,
        y: mouseY - (mouseY - offset.y) * zoomRatio
      }
    });
  }, [zoom, offset, onStateChange]);

  // Socket事件处理现在通过props传入
  useEffect(() => {
    if (onDrawingStarted) {
      // 当收到drawing_started事件时的处理逻辑可以在这里
    }
  }, [onDrawingStarted, onDrawingUpdated, onDrawingEnded, onDrawingsCleared, currentUser.id]);

  // 使用requestAnimationFrame优化重绘
  useEffect(() => {
    const scheduleRedraw = () => {
      // 清除之前的重绘请求
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (redrawTimeoutRef.current) {
        clearTimeout(redrawTimeoutRef.current);
      }
      
      // 如果正在绘画，立即重绘以保持流畅性
      if (isDrawing) {
        animationFrameRef.current = requestAnimationFrame(() => {
          redrawCanvas();
        });
      } else {
        // 如果不在绘画，使用防抖延迟重绘
        redrawTimeoutRef.current = window.setTimeout(() => {
          animationFrameRef.current = requestAnimationFrame(() => {
            redrawCanvas();
          });
        }, 16); // 16ms 防抖
      }
    };

    // 只在必要时重绘
    scheduleRedraw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (redrawTimeoutRef.current) {
        clearTimeout(redrawTimeoutRef.current);
      }
    };
  }, [zoom, offset, drawingPaths, currentPath, showCoordinates, isDrawing, redrawCanvas]); // 添加isDrawing依赖

  // 设置画布光标
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === 'pan') {
      canvas.style.cursor = isPanning ? 'grabbing' : 'grab';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }, [tool, isPanning]);

  // 监听来自服务器的绘画路径，更新当前路径ID
  useEffect(() => {
    if (!currentPath || currentPath.id || !currentUser) return;
    
    // 查找最新的属于当前用户的路径
    const latestUserPath = drawingPaths
      .filter(path => path.userId === currentUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    if (latestUserPath && !currentPath.id) {
      console.log('✅ 从服务器获得路径ID，更新当前路径:', { 
        pathId: latestUserPath.id, 
        currentPathPoints: currentPath.points.length,
        serverPathPoints: latestUserPath.points.length 
      });
      
      // 更新当前路径的ID
      setCurrentPath(prev => prev ? { ...prev, id: latestUserPath.id } : null);
    }
  }, [drawingPaths, currentPath, currentUser]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0f0f0' }}>
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          display: 'block',
          background: 'white',
          touchAction: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      
      {/* 坐标显示覆盖层 - 只在启用时显示 */}
      {showCoordinates && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontFamily: 'monospace',
          zIndex: 999,
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)'
        }}>
          🌍 ({Math.round(-offset.x)}, {Math.round(-offset.y)}) | 
          🔍 {Math.round(zoom * 100)}% | 
          👥 {users.length + 1} 人在线
        </div>
      )}
    </div>
  );
});

export default InfiniteCanvas; 