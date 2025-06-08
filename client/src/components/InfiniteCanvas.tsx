import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Socket } from 'socket.io-client';
import { CanvasState, User, Point } from '../types';
import { generateRandomInitialPosition } from '../utils/user';

interface InfiniteCanvasProps {
  canvasState: CanvasState;
  onStateChange: (newState: Partial<CanvasState>) => void;
  socket: Socket | null;
  currentUser: User;
  users: User[];
}

export interface InfiniteCanvasRef {
  clearMyDrawings: () => void;
}

interface DrawingPath {
  id: string;
  userId: string;
  username: string;
  points: Point[];
  color: string;
  size: number;
  createdAt: Date;
}

const InfiniteCanvas = forwardRef<InfiniteCanvasRef, InfiniteCanvasProps>(({
  canvasState,
  onStateChange,
  socket,
  currentUser,
  users
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
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
    if (!socket) return;
    
    socket.emit('clear_my_drawings', {
      roomId: 'global'
    });
  }, [socket]);

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
    ctx.lineWidth = path.size / zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over'; // 确保正常绘制模式
    
    ctx.beginPath();
    
    if (path.points.length === 1) {
      // 单点绘制为小圆圈
      const point = path.points[0];
      ctx.fillStyle = path.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, path.size / zoom / 2, 0, Math.PI * 2);
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
  const updateDrawing = useCallback((coords: Point) => {
    if (!socket || !currentPath || !currentUser) {
      console.log('⚠️ updateDrawing 跳过:', { 
        socket: !!socket, 
        currentPath: !!currentPath, 
        currentUser: !!currentUser,
        currentUserId: currentUser?.id 
      });
      return;
    }

    const now = Date.now();
    // 限制更新频率为30fps，减少重绘频率
    if (now - lastDrawingUpdateRef.current < 33) return;
    
    lastDrawingUpdateRef.current = now;

    const updatedPath = {
      ...currentPath,
      points: [...currentPath.points, coords]
    };
    
    // 使用批量更新，减少重绘次数
    setCurrentPath(updatedPath);
    
    console.log('🖌️ 更新绘画路径:', { 
      pathId: currentPath.id, 
      pointsCount: updatedPath.points.length,
      hasId: !!currentPath.id,
      coords,
      userId: currentUser.id
    });

    // 只有当路径有ID时才发送更新到服务器
    if (currentPath.id) {
      socket.emit('drawing_update', {
        roomId: 'global',
        pathId: currentPath.id,
        points: updatedPath.points
      });
      console.log('📡 发送绘画更新到服务器:', { pathId: currentPath.id, pointsCount: updatedPath.points.length });
    } else {
      console.log('⏳ 等待路径ID分配，暂不发送更新');
    }
  }, [socket, currentPath, currentUser]);

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
    } else if (isDrawing && lastPointRef.current && currentPath && socket) {
      // 绘画 - 使用节流更新
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      
      // 检查距离，避免过于密集的点
      const distance = Math.sqrt(
        Math.pow(coords.x - lastPointRef.current.x, 2) + 
        Math.pow(coords.y - lastPointRef.current.y, 2)
      );
      
      if (distance > 2) { // 最小距离阈值
        console.log('🎨 鼠标移动触发绘画更新:', { coords, distance, currentPathId: currentPath?.id });
        updateDrawing(coords);
        lastPointRef.current = coords;
      }
    }
  }, [isPanning, isDrawing, getCanvasCoordinates, currentPath, socket, offset, onStateChange, updateDrawing]);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!socket || !currentUser) {
      console.log('⚠️ 无法开始绘画 - 未连接或用户未认证:', { socket: !!socket, currentUser: !!currentUser });
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
          username: currentUser.name,
          points: [coords],
          color: color,
          size: size,
          createdAt: new Date()
        };
        setCurrentPath(newPath);
        console.log('创建新路径:', newPath);

        // 发送到服务器
        socket.emit('drawing_start', {
          roomId: 'global',
          path: {
            points: [coords],
            color: color,
            size: size
          }
        });
        
        console.log('📡 已发送绘画开始请求到服务器');
      }
    }
  }, [tool, color, size, getCanvasCoordinates, socket, currentUser, isDrawing]);

  // 处理鼠标抬起
  const handleMouseUp = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanning) {
      setIsPanning(false);
      lastPanPointRef.current = null;
      canvas.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
    }
    
    if (isDrawing && currentPath && socket) {
      // 完成当前路径 - 只有当路径有ID时才发送结束事件
      if (currentPath.id) {
        socket.emit('drawing_end', {
          roomId: 'global',
          pathId: currentPath.id
        });
      }
      
      setCurrentPath(null);
      setCurrentPathId(null);
      setIsDrawing(false);
      lastPointRef.current = null;
    }
  }, [isPanning, isDrawing, tool, currentPath, socket]);

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

  // Socket事件监听
  useEffect(() => {
    if (!socket) return;

    socket.on('drawing_started', ({ path }) => {
      console.log('收到新绘画:', path);
      
      if (path.userId === currentUser.id) {
        // 这是当前用户的路径，更新当前路径的ID，但不添加到drawingPaths中
        setCurrentPathId(path.id);
        setCurrentPath(prev => prev ? { ...prev, id: path.id } : null);
        console.log('更新当前路径ID:', path.id);
      } else {
        // 这是其他用户的路径，添加到drawingPaths中
        setDrawingPaths(prev => [...prev, path]);
      }
    });

    socket.on('drawing_updated', ({ pathId, points }) => {
      console.log('收到绘画更新:', { pathId, pointsCount: points.length });
      
      // 只更新其他用户的路径，不更新当前正在绘制的路径
      if (pathId !== currentPathId) {
        setDrawingPaths(prev => 
          prev.map(path => 
            path.id === pathId ? { ...path, points } : path
          )
        );
      }
    });

    socket.on('drawing_ended', ({ pathId }) => {
      console.log('收到绘画结束:', pathId);
      
      // 如果是当前用户的路径结束，将当前路径移动到drawingPaths中
      if (pathId === currentPathId && currentPath) {
        setDrawingPaths(prev => [...prev, { ...currentPath, id: pathId }]);
        setCurrentPath(null);
        setCurrentPathId(null);
      }
    });

    socket.on('drawings_cleared', ({ userId, deletedPathIds }) => {
      console.log('用户清空绘画:', userId, deletedPathIds);
      setDrawingPaths(prev => 
        prev.filter(path => !deletedPathIds.includes(path.id))
      );
      
      // 如果是当前用户清空，也清空当前路径
      if (userId === currentUser.id) {
        setCurrentPath(null);
        setCurrentPathId(null);
        setIsDrawing(false);
      }
    });

    return () => {
      socket.off('drawing_started');
      socket.off('drawing_updated');
      socket.off('drawing_ended');
      socket.off('drawings_cleared');
    };
  }, [socket, currentUser.id, currentPathId, currentPath]);

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
          👥 {users.length} 人在线
        </div>
      )}
    </div>
  );
});

export default InfiniteCanvas; 