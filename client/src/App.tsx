import React, { useState, useRef } from 'react';
import InfiniteCanvas from './components/InfiniteCanvas';
import UnifiedPanel from './components/UnifiedPanel';
import { CanvasState, User } from './types';
import { useSocket } from './hooks/useSocket';
import { generateUserId, generateUserName, generateUserColor, generateRandomInitialPosition } from './utils/user';

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

  const [currentUser] = useState<User>(() => ({
    id: generateUserId(),
    name: generateUserName(),
    color: generateUserColor()
  }));

  const { socket, users, isConnected, currentUser: syncedUser } = useSocket(currentUser);

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

  return (
    <div className="app" style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <InfiniteCanvas 
        ref={canvasRef}
        canvasState={canvasState}
        onStateChange={handleCanvasStateChange}
        socket={socket}
        currentUser={syncedUser || currentUser}
        users={users}
      />
      <UnifiedPanel
        canvasState={canvasState}
        onStateChange={handleCanvasStateChange}
        onClearCanvas={handleClearCanvas}
        onRandomTeleport={handleRandomTeleport}
        currentUser={syncedUser || currentUser}
        users={users}
        isConnected={isConnected}
      />
    </div>
  );
};

export default App; 