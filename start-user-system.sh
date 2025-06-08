#!/bin/bash

echo "🚀 启动用户登录系统的无限画布..."

# 检查依赖
echo "📦 检查依赖..."
cd server && npm install
cd ../client && npm install
cd ..

# 启动服务器
echo "🔧 启动服务器..."
cd server
npm run build
npm start &
SERVER_PID=$!

# 等待服务器启动
echo "⏳ 等待服务器启动..."
sleep 3

# 启动客户端
echo "🎨 启动客户端..."
cd ../client
npm run dev &
CLIENT_PID=$!

echo "✅ 系统启动完成！"
echo "📊 服务器: http://localhost:3001"
echo "🎨 客户端: http://localhost:3002"
echo ""
echo "🎯 功能特性："
echo "• 👤 用户登录系统"
echo "• 🎨 多人实时协作绘画"
echo "• 🔒 权限控制 - 只能修改自己的作品"
echo "• 🌈 每个用户有独特的颜色标识"
echo "• 💾 绘画内容持久化存储"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo '🛑 正在停止服务...'; kill $SERVER_PID $CLIENT_PID; exit" INT
wait 