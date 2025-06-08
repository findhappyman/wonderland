import React, { useState, useRef } from 'react';
import InfiniteCanvas from './components/InfiniteCanvas';
import UnifiedPanel from './components/UnifiedPanel';
import { CanvasState, User } from './types';
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

  // 服务器会基于IP自动分配用户身份，这里只需要一个临时的占位用户
  const placeholderUser: User = {
    id: 'temp',
    name: '连接中...',
    color: '#999999'
  };

  const { socket, users, isConnected, currentUser } = useSocket();

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

  return (
    <div className="app" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <InfiniteCanvas 
        ref={canvasRef}
        canvasState={canvasState}
        onStateChange={handleCanvasStateChange}
        socket={socket}
        currentUser={currentUser || placeholderUser}
        users={users}
      />
      <UnifiedPanel
        canvasState={canvasState}
        onStateChange={handleCanvasStateChange}
        onClearCanvas={handleClearCanvas}
        onRandomTeleport={handleRandomTeleport}
        onUpdateUsername={handleUpdateUsername}
        currentUser={currentUser || placeholderUser}
        users={users}
        isConnected={isConnected}
      />
    </div>
  );
};

export default App; 