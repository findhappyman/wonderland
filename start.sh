#!/bin/bash

echo "🚀 启动无限画布应用..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 请先安装 Node.js"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 请先安装 npm"
    exit 1
fi

echo "📦 安装依赖..."

# 安装服务器依赖
echo "安装服务器依赖..."
cd server && npm install
if [ $? -ne 0 ]; then
    echo "❌ 服务器依赖安装失败"
    exit 1
fi

# 安装客户端依赖
echo "安装客户端依赖..."
cd ../client && npm install
if [ $? -ne 0 ]; then
    echo "❌ 客户端依赖安装失败"
    exit 1
fi

cd ..

echo "🎯 启动服务..."

# 启动服务器（后台运行）
echo "启动服务器 (端口 3001)..."
cd server && npm run dev &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 启动客户端（后台运行）
echo "启动客户端 (端口 3000)..."
cd ../client && npm run dev &
CLIENT_PID=$!

# 等待客户端启动
sleep 5

echo ""
echo "✅ 无限画布应用启动成功！"
echo ""
echo "🌐 访问地址:"
echo "   客户端: http://localhost:3000"
echo "   服务器: http://localhost:3001"
echo ""
echo "📝 使用说明:"
echo "   - 鼠标左键拖拽: 绘画"
echo "   - 鼠标右键拖拽: 移动画布"
echo "   - 滚轮: 缩放"
echo "   - 左上角工具栏: 选择工具和颜色"
echo ""
echo "⚠️  按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo ''; echo '🛑 正在停止服务...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; echo '✅ 服务已停止'; exit 0" INT

# 保持脚本运行
wait 