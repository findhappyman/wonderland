import React, { useState, useRef } from 'react';
import InfiniteCanvas from './components/InfiniteCanvas';
import UnifiedPanel from './components/UnifiedPanel';
import LoginModal from './components/LoginModal';
import { CanvasState } from './types';
import { useSocket } from './hooks/useSocket';
import { generateRandomInitialPosition } from './utils/user';

const App: React.FC = () => {
  const canvasRef = useRef<{ clearMyDrawings: () => void }>(null);
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    offset: { x: 0, y: 0 },
    tool: 'pen',
    color: '#000000',
    size: 5,
    showCoordinates: false,
    currentCoordinates: { x: 0, y: 0 }
  });

  const { 
    isConnected,
    isLoggedIn, 
    currentUser, 
    users, 
    drawingPaths,
    loginError,
    isAutoLoginAttempting,
    login, 
    logout,
    updateUsername,
    sendDrawing,
    updateDrawing,
    endDrawing,
    clearMyDrawings 
  } = useSocket();

  const handleCanvasStateChange = (newState: Partial<CanvasState>) => {
    setCanvasState(prev => ({ ...prev, ...newState }));
  };

  const handleRandomTeleport = () => {
    const randomPosition = generateRandomInitialPosition();
    handleCanvasStateChange({ offset: randomPosition });
    console.log('🎯 随机传送到新坐标:', randomPosition);
  };

  const handleClearCanvas = () => {
    clearMyDrawings();
  };

  const handleUpdateUsername = (newUsername: string) => {
    updateUsername(newUsername);
  };

  // 处理绘画事件
  const handleDrawingStarted = (path: any) => {
    console.log('绘画开始:', path);
    // 可以在这里添加额外的逻辑
  };

  const handleDrawingUpdated = (pathId: string, points: any[]) => {
    console.log('绘画更新:', { pathId, pointsCount: points.length });
    // 可以在这里添加额外的逻辑
  };

  const handleDrawingEnded = (pathId: string) => {
    console.log('绘画结束:', pathId);
    // 可以在这里添加额外的逻辑
  };

  const handleDrawingsCleared = (userId: string, deletedPathIds: string[]) => {
    console.log('绘画清空:', { userId, deletedPathIds });
    // 可以在这里添加额外的逻辑
  };

  const handleLogin = (userId: string, username: string, password: string) => {
    console.log('🚀 App: 开始登录', { userId, username, passwordLength: password.length });
    return login(userId, username, password, 'main');
  };

  const handleLogout = () => {
    console.log('👋 App: 用户登出');
    logout();
  };

  // 获取连接状态显示文本
  const getConnectionStatus = () => {
    if (!isConnected) {
      return '❌ 无法连接到服务器，请检查网络连接';
    }
    if (isAutoLoginAttempting) {
      return '🔄 正在尝试自动登录...';
    }
    if (!isLoggedIn) {
      return '⏳ 请登录以开始使用';
    }
    return '✅ 已连接并登录';
  };

  // 如果正在自动登录，显示加载界面
  if (isAutoLoginAttempting) {
    return (
      <div className="app" style={{ position: 'relative', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '6px solid #f3f3f3',
            borderTop: '6px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <h2 style={{ color: '#333', marginBottom: '10px' }}>🔄 正在自动登录...</h2>
          <p style={{ color: '#666', margin: 0 }}>请稍候，我们正在恢复您的登录状态</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 如果未登录，显示登录界面
  if (!isLoggedIn) {
    return (
      <div className="app" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        {/* 背景画布预览 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          opacity: 0.3,
          zIndex: 1
        }} />
        
        {/* 状态指示器 */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 20px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 10,
          backdropFilter: 'blur(10px)'
        }}>
          {getConnectionStatus()}
        </div>
        
        <LoginModal
          isOpen={true}
          onLogin={handleLogin}
          isConnecting={isConnected && !isLoggedIn}
          error={loginError || undefined}
        />
      </div>
    );
  }

  // 已登录，显示主应用界面
  return (
    <div className="app" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <InfiniteCanvas 
        ref={canvasRef}
        canvasState={canvasState}
        onStateChange={handleCanvasStateChange}
        currentUser={currentUser!}
        users={users}
        drawingPaths={drawingPaths}
        sendDrawing={sendDrawing}
        updateDrawing={updateDrawing}
        endDrawing={endDrawing}
        clearMyDrawings={clearMyDrawings}
        onDrawingStarted={handleDrawingStarted}
        onDrawingUpdated={handleDrawingUpdated}
        onDrawingEnded={handleDrawingEnded}
        onDrawingsCleared={handleDrawingsCleared}
      />
      <UnifiedPanel
        canvasState={canvasState}
        onStateChange={handleCanvasStateChange}
        onClearCanvas={handleClearCanvas}
        onRandomTeleport={handleRandomTeleport}
        onUpdateUsername={handleUpdateUsername}
        onLogout={handleLogout}
        currentUser={currentUser!}
        users={users}
        isConnected={isConnected}
      />
    </div>
  );
};

export default App; 