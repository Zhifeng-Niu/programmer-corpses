#!/bin/bash

# 🪦 程序员墓地 - GitHub 发布脚本
# 
# 使用方法:
# 1. 确保已安装 GitHub CLI: brew install gh
# 2. 运行此脚本: ./setup-github.sh

echo "🪦 程序员墓地 - GitHub 发布"
echo "================================"

# 检查 gh 是否安装
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI 未安装。请先安装:"
    echo "   brew install gh"
    exit 1
fi

# 1. 登录 GitHub
echo ""
echo "📝 步骤 1: 登录 GitHub"
echo "----------------------"
gh auth login --web

# 2. 创建仓库
echo ""
echo "📦 步骤 2: 创建 GitHub 仓库"
echo "----------------------------"
gh repo create programmer-cemetery \
    --public \
    --description "🪦 纪念那些死掉的代码 - 程序员墓地 CLI 工具" \
    --source=. \
    --push

# 3. 完成
echo ""
echo "✅ 完成!"
echo "📱 仓库地址: https://github.com/stbz/programmer-cemetery"
echo ""
echo "💡 提示: 可以运行以下命令测试:"
echo "   npm run visit"
