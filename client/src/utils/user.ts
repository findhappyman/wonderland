import { Point } from '../types';

export const generateUserId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateUserName = (): string => {
  const adjectives = ['快乐的', '创意的', '神秘的', '勇敢的', '聪明的', '友善的', '活泼的', '优雅的'];
  const nouns = ['画家', '艺术家', '创作者', '设计师', '梦想家', '探索者', '建造者', '思考者'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);
  
  return `${adjective}${noun}${number}`;
};

export const generateUserColor = (): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#AED6F1', '#F1948A', '#D7BDE2'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// 生成随机初始坐标
export const generateRandomInitialPosition = (): Point => {
  // 在一个较大的范围内生成随机坐标
  // 范围：-5000 到 5000 像素
  const range = 5000;
  return {
    x: (Math.random() - 0.5) * 2 * range,
    y: (Math.random() - 0.5) * 2 * range
  };
};

// 格式化坐标显示
export const formatCoordinates = (point: Point): string => {
  return `(${Math.round(point.x)}, ${Math.round(point.y)})`;
}; 