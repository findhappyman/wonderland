# 多阶段构建 Dockerfile
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 文件
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# 安装依赖
RUN cd client && npm ci --only=production
RUN cd server && npm ci --only=production

# 复制源代码
COPY client/ ./client/
COPY server/ ./server/

# 构建前端
RUN cd client && npm run build

# 生产阶段
FROM node:18-alpine AS production

# 安装 dumb-init 用于信号处理
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# 设置工作目录
WORKDIR /app

# 复制服务器代码和依赖
COPY --from=builder --chown=nextjs:nodejs /app/server/ ./server/
COPY --from=builder --chown=nextjs:nodejs /app/client/dist/ ./client/dist/

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/src/simple-server.js"] 