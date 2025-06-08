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
    socket, 
    users, 
    isConnected, 
    currentUser,
    isLoggedIn,
    loginError,
    login,
    logout
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
    if (canvasRef.current) {
      canvasRef.current.clearMyDrawings();
    }
  };

  const handleUpdateUsername = (newUsername: string) => {
    if (socket && isConnected) {
      socket.emit('update_username', { username: newUsername });
    }
  };

  const handleLogin = (userId: string, username: string, password: string) => {
    console.log('🚀 App: 开始登录', { userId, username, passwordLength: password.length });
    login(userId, username, password);
  };

  const handleLogout = () => {
    console.log('👋 App: 用户登出');
    logout();
  };

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
        socket={socket}
        currentUser={currentUser!}
        users={users}
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