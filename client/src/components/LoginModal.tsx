import React, { useState, useEffect } from 'react';
import '../styles/LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
  onLogin: (userId: string, username: string, password: string) => void;
  isConnecting: boolean;
  error?: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLogin, isConnecting, error }) => {
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  // 生成随机建议的用户ID
  const generateSuggestedId = () => {
    const adjectives = ['Creative', 'Artistic', 'Bright', 'Swift', 'Bold', 'Clever', 'Cool', 'Epic'];
    const nouns = ['Artist', 'Painter', 'Creator', 'Designer', 'Dreamer', 'Maker', 'Builder', 'Thinker'];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    return `${adjective}${noun}${number}`;
  };

  // 生成随机建议的用户名
  const generateSuggestedUsername = () => {
    const adjectives = ['快乐的', '创意的', '勇敢的', '聪明的', '活泼的', '温柔的', '坚强的', '优雅的'];
    const nouns = ['画家', '艺术家', '创作者', '设计师', '建造者', '思考者', '梦想家', '探索者'];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 100);
    return `${adjective}${noun}${number}`;
  };

  // 生成随机密码
  const generateSuggestedPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // 验证表单
  useEffect(() => {
    const isUserIdValid = userId.trim().length >= 3 && userId.trim().length <= 20;
    const isUsernameValid = username.trim().length >= 2 && username.trim().length <= 20;
    const isPasswordValid = password.trim().length >= 6 && password.trim().length <= 50;
    setIsFormValid(isUserIdValid && isUsernameValid && isPasswordValid && !isConnecting);
  }, [userId, username, password, isConnecting]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      onLogin(userId.trim(), username.trim(), password.trim());
    }
  };

  const handleGenerateRandom = () => {
    setUserId(generateSuggestedId());
    setUsername(generateSuggestedUsername());
    setPassword(generateSuggestedPassword());
  };

  if (!isOpen) return null;

  return (
    <div className="login-modal-overlay">
      <div className="login-modal">
        <div className="login-header">
          <h1>🎨 欢迎来到 Wonderland</h1>
          <p>无限画布 · 全球协作绘画</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="userId">用户ID *</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="请输入3-20字符的唯一ID"
              maxLength={20}
              disabled={isConnecting}
            />
            <small>用于识别你的身份，其他用户可以看到</small>
          </div>

          <div className="form-group">
            <label htmlFor="username">显示名称 *</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入2-20字符的显示名称"
              maxLength={20}
              disabled={isConnecting}
            />
            <small>在画布上显示的名称</small>
          </div>

          <div className="form-group">
            <label htmlFor="password">登录密码 *</label>
            <div className="password-input-container">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入6-50字符的密码"
                maxLength={50}
                disabled={isConnecting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="password-toggle"
                disabled={isConnecting}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <small>密码用于保护你的账户安全</small>
          </div>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={handleGenerateRandom}
              className="btn-secondary"
              disabled={isConnecting}
            >
              🎲 随机生成
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={!isFormValid}
            >
              {isConnecting ? (
                <>
                  <span className="spinner"></span>
                  连接中...
                </>
              ) : (
                <>
                  🚀 开始创作
                </>
              )}
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p>🔐 你的账户信息将被安全保护</p>
          <p>✨ 支持多人实时协作绘画</p>
          <p>🌍 与全世界的艺术家一起创作</p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal; 