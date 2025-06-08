import React, { useState, useEffect } from 'react';
import { CanvasState, User } from '../types';

interface UnifiedPanelProps {
  canvasState: CanvasState;
  onStateChange: (newState: Partial<CanvasState>) => void;
  onClearCanvas?: () => void;
  onRandomTeleport?: () => void;
  currentUser: User;
  users: User[];
  isConnected: boolean;
}

const UnifiedPanel: React.FC<UnifiedPanelProps> = ({
  canvasState,
  onStateChange,
  onClearCanvas,
  onRandomTeleport,
  currentUser,
  users,
  isConnected
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'users'>('tools');

  const { tool, color, size, zoom, showCoordinates, currentCoordinates } = canvasState;

  // 检测移动设备
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // 防止背景滚动
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isExpanded]);

  // 滚动到底部的引用
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const coordinatesRef = React.useRef<HTMLDivElement>(null);

  // 滚动到坐标显示区域
  const scrollToCoordinates = () => {
    if (scrollContainerRef.current) {
      const coordinatesElement = scrollContainerRef.current.querySelector('[data-coordinates]');
      coordinatesElement?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end',
        inline: 'nearest'
      });
    }
  };

  const presetColors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500',
    '#800080', '#008000', '#800000', '#000080'
  ];

  const resetView = () => {
    onStateChange({ zoom: 1, offset: { x: 0, y: 0 } });
  };

  return (
    <>
      {/* 悬浮控制按钮 */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        zIndex: 1002,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* 主菜单按钮 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            background: isExpanded ? '#007AFF' : 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isExpanded ? '✕' : '☰'}
        </button>

        {/* 快速工具切换 */}
        {!isExpanded && (
          <button
            onClick={() => onStateChange({ tool: tool === 'pen' ? 'pan' : 'pen' })}
            style={{
              width: '45px',
              height: '45px',
              borderRadius: '50%',
              border: 'none',
              background: tool === 'pen' ? '#34C759' : '#FF9500',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {tool === 'pen' ? '✏️' : '✋'}
          </button>
        )}
      </div>

      {/* 连接状态指示器 */}
      {!isExpanded && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '8px 12px',
          zIndex: 1001,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'white',
          fontSize: '12px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isConnected ? '#34C759' : '#FF3B30'
          }} />
          <span>{users.length + 1} 人在线</span>
        </div>
      )}

      {/* 展开的面板 */}
      {isExpanded && (
        <>
          {/* 背景遮罩 */}
          <div
            onClick={() => setIsExpanded(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              zIndex: 1000,
              backdropFilter: 'blur(5px)'
            }}
          />

          {/* 侧边栏 */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: isMobile ? '100vw' : '400px',
            height: '100vh',
            background: 'white',
            zIndex: 1001,
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            transform: 'translateX(0)',
            transition: 'transform 0.3s ease-out'
          }}>
            {/* 头部 */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>
                🎨 无限画布
              </h2>
              <button
                onClick={() => setIsExpanded(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>

            {/* 标签切换 */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e0e0e0',
              flexShrink: 0
            }}>
              <button
                onClick={() => setActiveTab('tools')}
                style={{
                  flex: 1,
                  padding: '15px',
                  border: 'none',
                  background: activeTab === 'tools' ? '#f5f5f5' : 'white',
                  color: activeTab === 'tools' ? '#007AFF' : '#666',
                  fontWeight: activeTab === 'tools' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🛠️ 工具
              </button>
              <button
                onClick={() => setActiveTab('users')}
                style={{
                  flex: 1,
                  padding: '15px',
                  border: 'none',
                  background: activeTab === 'users' ? '#f5f5f5' : 'white',
                  color: activeTab === 'users' ? '#007AFF' : '#666',
                  fontWeight: activeTab === 'users' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                👥 用户 ({users.length + 1})
              </button>
            </div>

            {/* 内容区域 - 修复移动端滚动 */}
            <div 
              ref={scrollContainerRef}
              style={{
                flex: 1,
                padding: '20px',
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch', // iOS 平滑滚动
                scrollbarWidth: 'thin', // Firefox 细滚动条
                minHeight: 0, // 确保 flex 子元素可以滚动
                maxHeight: 'calc(100vh - 140px)', // 限制最大高度，为头部和标签预留空间
                position: 'relative'
              }}>
              {activeTab === 'tools' && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '24px',
                  paddingBottom: isMobile ? '120px' : '40px', // 移动端增加更多底部间距
                  minHeight: isMobile ? 'calc(100vh - 200px)' : 'auto' // 移动端确保最小高度
                }}>
                  {/* 移动端快速滚动按钮 */}
                  {isMobile && (
                    <div style={{
                      position: 'sticky',
                      top: '0',
                      zIndex: 10,
                      background: 'white',
                      padding: '12px 0',
                      borderBottom: '1px solid #e0e0e0',
                      marginBottom: '12px'
                    }}>
                      <button
                        onClick={scrollToCoordinates}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #007AFF',
                          borderRadius: '12px',
                          background: '#f0f8ff',
                          color: '#007AFF',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        📍 快速跳转到坐标显示
                      </button>
                    </div>
                  )}

                  {/* 工具选择 */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                      🛠️ 绘画工具
                    </h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => onStateChange({ tool: 'pen' })}
                        style={{
                          flex: 1,
                          padding: '12px',
                          border: tool === 'pen' ? '2px solid #007AFF' : '2px solid #e0e0e0',
                          borderRadius: '12px',
                          background: tool === 'pen' ? '#f0f8ff' : 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        ✏️ 画笔
                      </button>
                      <button
                        onClick={() => onStateChange({ tool: 'pan' })}
                        style={{
                          flex: 1,
                          padding: '12px',
                          border: tool === 'pan' ? '2px solid #007AFF' : '2px solid #e0e0e0',
                          borderRadius: '12px',
                          background: tool === 'pan' ? '#f0f8ff' : 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        ✋ 拖动
                      </button>
                    </div>
                  </div>

                  {/* 画笔大小 */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                      📏 画笔大小: {size}px
                    </h3>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={size}
                      onChange={(e) => onStateChange({ size: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        height: '6px',
                        borderRadius: '3px',
                        background: '#e0e0e0',
                        outline: 'none',
                        accentColor: '#007AFF'
                      }}
                    />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#666',
                      marginTop: '4px'
                    }}>
                      <span>1px</span>
                      <span>50px</span>
                    </div>
                  </div>

                  {/* 颜色选择 */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                      🎨 颜色选择
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
                      {presetColors.map(presetColor => (
                        <button
                          key={presetColor}
                          onClick={() => onStateChange({ color: presetColor })}
                          style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: presetColor,
                            border: color === presetColor ? '3px solid #007AFF' : '2px solid #e0e0e0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => onStateChange({ color: e.target.value })}
                      style={{
                        width: '100%',
                        height: '50px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '12px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {/* 视图控制 */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                      🔍 视图控制 (缩放: {Math.round(zoom * 100)}%)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        onClick={resetView}
                        style={{
                          padding: '12px',
                          border: 'none',
                          borderRadius: '12px',
                          background: '#007AFF',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        🎯 重置视图
                      </button>
                      {onRandomTeleport && (
                        <button
                          onClick={onRandomTeleport}
                          style={{
                            padding: '12px',
                            border: 'none',
                            borderRadius: '12px',
                            background: '#FF6B6B',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          🎲 随机传送
                        </button>
                      )}
                      {onClearCanvas && (
                        <button
                          onClick={onClearCanvas}
                          style={{
                            padding: '12px',
                            border: 'none',
                            borderRadius: '12px',
                            background: '#FF3B30',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          🗑️ 清空我的绘画
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 坐标显示 - 确保在移动端可见 */}
                  <div 
                    ref={coordinatesRef}
                    style={{
                      padding: '20px',
                      background: '#f8f9fa',
                      borderRadius: '16px',
                      border: '3px solid #007AFF',
                      marginBottom: isMobile ? '20px' : '0', // 移动端额外底部间距
                      boxShadow: '0 4px 12px rgba(0, 122, 255, 0.15)' // 添加阴影增强可见性
                    }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      cursor: 'pointer',
                      fontSize: '18px',
                      color: '#333',
                      fontWeight: 'bold'
                    }}>
                      <input
                        type="checkbox"
                        checked={showCoordinates || false}
                        onChange={(e) => onStateChange({ showCoordinates: e.target.checked })}
                        style={{ 
                          transform: 'scale(2)',
                          accentColor: '#007AFF',
                          marginRight: '8px'
                        }}
                      />
                      📍 显示坐标信息
                    </label>
                    {showCoordinates && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'white',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#666',
                        fontFamily: 'monospace',
                        border: '1px solid #e0e0e0'
                      }}>
                        当前位置: ({Math.round(currentCoordinates?.x || 0)}, {Math.round(currentCoordinates?.y || 0)})
                      </div>
                    )}
                    {/* 移动端滚动提示 */}
                    {isMobile && (
                      <div style={{
                        marginTop: '12px',
                        fontSize: '12px',
                        color: '#999',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        ✅ 已滚动到底部
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  paddingBottom: isMobile ? '120px' : '40px', // 移动端增加更多底部间距
                  minHeight: isMobile ? 'calc(100vh - 200px)' : 'auto' // 移动端确保最小高度
                }}>
                  {/* 连接状态 */}
                  <div style={{
                    padding: '16px',
                    background: isConnected ? '#f0fff4' : '#fff5f5',
                    borderRadius: '12px',
                    border: `2px solid ${isConnected ? '#34C759' : '#FF3B30'}`
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: isConnected ? '#34C759' : '#FF3B30'
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: isConnected ? '#34C759' : '#FF3B30'
                      }} />
                      {isConnected ? '已连接' : '连接中...'}
                    </div>
                  </div>

                  {/* 当前用户 */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                      👤 我的信息
                    </h3>
                    <div style={{
                      padding: '16px',
                      background: '#f0f8ff',
                      borderRadius: '12px',
                      border: '2px solid #007AFF'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: currentUser.color
                        }} />
                        <span style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: '#333'
                        }}>
                          {currentUser.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 在线用户列表 */}
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                      👥 在线用户 ({users.length})
                    </h3>
                    <div style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      {users.length === 0 ? (
                        <div style={{
                          padding: '20px',
                          textAlign: 'center',
                          color: '#999',
                          fontSize: '14px'
                        }}>
                          {isConnected ? '等待其他用户加入...' : '连接中...'}
                        </div>
                      ) : (
                        users.map(user => (
                          <div key={user.id} style={{
                            padding: '12px',
                            borderRadius: '12px',
                            background: user.id === currentUser.id ? '#f0f8ff' : '#f8f9fa',
                            border: user.id === currentUser.id ? '2px solid #007AFF' : '1px solid #e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: user.color
                            }} />
                            <span style={{
                              fontSize: '14px',
                              fontWeight: user.id === currentUser.id ? 'bold' : 'normal',
                              color: '#333'
                            }}>
                              {user.name}
                              {user.id === currentUser.id && ' (我)'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 提示信息 */}
                  <div style={{
                    padding: '16px',
                    background: '#fff3cd',
                    borderRadius: '12px',
                    fontSize: '14px',
                    color: '#856404',
                    lineHeight: '1.5',
                    marginBottom: isMobile ? '20px' : '0' // 移动端额外底部间距
                  }}>
                    💡 提示：这是一个全球共享的无限画布，所有人的绘画都会实时同步显示。请文明创作，共同维护良好的创作环境！
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default UnifiedPanel; 