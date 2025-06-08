#!/bin/bash

echo "🚀 无限画布 - 一键部署脚本"
echo "================================"

# 检查是否安装了必要工具
check_tools() {
    echo "🔍 检查必要工具..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm 未安装，请先安装 npm"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo "❌ git 未安装，请先安装 git"
        exit 1
    fi
    
    echo "✅ 工具检查完成"
}

# 安装依赖
install_dependencies() {
    echo "📦 安装依赖..."
    
    echo "安装服务器依赖..."
    cd server && npm install
    
    echo "安装客户端依赖..."
    cd ../client && npm install
    
    echo "✅ 依赖安装完成"
}

# 构建项目
build_project() {
    echo "🔨 构建项目..."
    
    cd client
    npm run build
    
    echo "✅ 项目构建完成"
}

# 部署选项
deploy_options() {
    echo ""
    echo "🌍 选择部署方案："
    echo "1. Vercel + Railway (推荐)"
    echo "2. Heroku"
    echo "3. 本地测试"
    echo "4. 手动部署指南"
    
    read -p "请选择 (1-4): " choice
    
    case $choice in
        1)
            deploy_vercel_railway
            ;;
        2)
            deploy_heroku
            ;;
        3)
            local_test
            ;;
        4)
            manual_guide
            ;;
        *)
            echo "❌ 无效选择"
            deploy_options
            ;;
    esac
}

# Vercel + Railway 部署
deploy_vercel_railway() {
    echo ""
    echo "🚀 Vercel + Railway 部署"
    echo "========================"
    echo ""
    echo "📋 请按以下步骤操作："
    echo ""
    echo "1. 前端部署到 Vercel:"
    echo "   - 访问 https://vercel.com"
    echo "   - 连接你的 GitHub 仓库"
    echo "   - 选择 'client' 目录作为根目录"
    echo "   - 添加环境变量: VITE_SERVER_URL=https://your-server.railway.app"
    echo ""
    echo "2. 后端部署到 Railway:"
    echo "   - 访问 https://railway.app"
    echo "   - 连接你的 GitHub 仓库"
    echo "   - 选择 'server' 目录"
    echo "   - 添加环境变量:"
    echo "     NODE_ENV=production"
    echo "     CLIENT_URL=https://your-app.vercel.app"
    echo ""
    echo "3. 更新客户端环境变量:"
    echo "   - 在 Vercel 中更新 VITE_SERVER_URL 为实际的 Railway 地址"
    echo ""
    echo "✅ 部署完成后，你的应用就可以全球访问了！"
}

# Heroku 部署
deploy_heroku() {
    echo ""
    echo "🚀 Heroku 部署"
    echo "=============="
    
    if ! command -v heroku &> /dev/null; then
        echo "❌ Heroku CLI 未安装"
        echo "请访问 https://devcenter.heroku.com/articles/heroku-cli 安装"
        return
    fi
    
    read -p "请输入应用名称: " app_name
    
    echo "创建 Heroku 应用..."
    heroku create $app_name
    
    echo "设置环境变量..."
    heroku config:set NODE_ENV=production
    heroku config:set CLIENT_URL=https://$app_name.herokuapp.com
    
    echo "部署应用..."
    git add .
    git commit -m "Deploy to Heroku"
    git push heroku main
    
    echo "✅ 部署完成！"
    echo "🌍 访问地址: https://$app_name.herokuapp.com"
}

# 本地测试
local_test() {
    echo ""
    echo "🧪 本地测试"
    echo "==========="
    
    echo "启动服务器..."
    cd ../server
    node src/simple-server.js &
    SERVER_PID=$!
    
    echo "等待服务器启动..."
    sleep 3
    
    echo "启动客户端..."
    cd ../client
    npm run dev &
    CLIENT_PID=$!
    
    echo ""
    echo "✅ 本地测试环境已启动！"
    echo "🌍 客户端: http://localhost:3002"
    echo "🔧 服务器: http://localhost:3001"
    echo ""
    echo "按 Ctrl+C 停止服务"
    
    # 等待用户中断
    trap "kill $SERVER_PID $CLIENT_PID; exit" INT
    wait
}

# 手动部署指南
manual_guide() {
    echo ""
    echo "📖 手动部署指南"
    echo "==============="
    echo ""
    echo "详细的部署指南请查看 DEPLOYMENT.md 文件"
    echo ""
    echo "快速链接："
    echo "- Vercel: https://vercel.com"
    echo "- Railway: https://railway.app"
    echo "- Heroku: https://heroku.com"
    echo "- DigitalOcean: https://digitalocean.com"
    echo ""
    echo "需要帮助？请查看项目 README 或提交 Issue"
}

# 主函数
main() {
    check_tools
    install_dependencies
    build_project
    deploy_options
}

# 运行主函数
main 