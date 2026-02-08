#!/bin/bash

# 🚀 Code Corpses Tauri - 快速启动脚本

set -e

echo "🪦 Code Corpses Tauri - 代码墓地监控"
echo "===================================="

# 检查 Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust 未安装，请先安装:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# 检查 Node.js
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 18+"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建
echo "🔨 构建项目..."
cargo tauri build

echo ""
echo "✅ 构建完成！"
echo ""
echo "📂 构建产物:"
echo "   - macOS: src-tauri/target/release/bundle/dmg/Code_Corpses_*.dmg"
echo "   - Windows: src-tauri/target/release/bundle/msi/Code Corpses_*.msi"
echo "   - Linux: src-tauri/target/release/bundle/deb/code-corpses_*.deb"
echo ""
echo "🟢 运行开发版本:"
echo "   cargo tauri dev"
