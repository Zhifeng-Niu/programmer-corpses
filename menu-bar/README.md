# 🪦 Code Corpses Tauri Menu Bar

> 用 Tauri 写的跨平台菜单栏应用，监控 GitHub 上的"诈尸"项目

![Code Corpses](https://img.shields.io/badge/Code-Corpses-6c5ce7?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?style=flat-square)
![Rust](https://img.shields.io/badge/Rust-1.70+-orange?style=flat-square)

---

## ✨ 特点

- ⚡ **极速** - 比 Electron 轻量 10 倍，启动毫秒级
- 🎨 **原生体验** - 系统 WebView，非 Electron
- 🌐 **跨平台** - macOS / Windows / Linux
- 🔔 **实时监控** - 自动检测 6 个月无活动的项目
- 🔒 **隐私安全** - 本地存储，GitHub Token 仅本地使用

---

## 🚀 快速开始

### 环境要求

- **Node.js** 18+
- **Rust** 1.70+
- **Tauri CLI**

```bash
# 安装 Rust (macOS/Linux)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli

# 安装依赖
cd code-corpses-tauri
npm install
```

### 运行

```bash
# 开发模式运行 (支持热重载)
cargo tauri dev

# 或者分开运行
npm run dev   # 前端
cargo tauri dev --no-watch  # 后端
```

### 构建

```bash
# 构建 macOS App
cargo tauri build --bundles app

# 构建所有平台
cargo tauri build
```

---

## 📦 项目结构

```
code-corpses-tauri/
├── src/
│   └── index.html       # 前端 UI (HTML + CSS + JS)
├── src-tauri/
│   ├── src/
│   │   └── main.rs     # Rust 后端 + Commands
│   ├── Cargo.toml      # Rust 依赖
│   └── tauri.conf.json # Tauri 配置
├── icons/              # 图标资源
├── package.json
├── vite.config.ts
└── README.md
```

---

## 🔧 功能说明

### 📊 监控面板

- **扫描项目总数** - GitHub 组织下的仓库总数
- **诈尸项目** - 6 个月以上无更新的项目
- **最近扫描** - 上次扫描的时间
- **总星数** - 所有墓碑项目的 Stars 总和

### 🔍 扫描墓地

点击 **"扫描墓地"** 按钮，程序将：

1. 连接 GitHub API
2. 获取指定组织的仓库列表
3. 检测长期无活动的项目
4. 自动保存到本地墓碑数据库
5. 显示扫描结果统计

### 📜 墓碑列表

显示检测到的诈尸项目，包括：

- 项目名称和语言
- 无活动时长原因
- Star 数量
- 最后活动时间
- 点击可打开 GitHub 页面

### ⚙️ 设置

点击 **"设置"** 可以：

- 配置 GitHub Personal Access Token
- 提高 API 访问速率限制 (从 60 次/小时提升到 5000 次/小时)

### 📤 发送报告

生成并发送墓地报告 (Telegram/Discord 待实现)

---

## ⚙️ 配置说明

### GitHub Token (推荐)

1. 创建 GitHub Personal Access Token:
   - 访问 https://github.com/settings/tokens
   - 点击 "Generate new token (Classic)"
   - 勾选 `repo` 和 `read:org` 权限
   - 复制 token

2. 在应用设置中输入 token

### 配置文件

程序会自动创建配置文件：

```json
// macOS: ~/Library/Application Support/code-corpses/cemetery.config.json
// Linux: ~/.local/share/code-corpses/cemetery.config.json
// Windows: %APPDATA%\code-corpses\cemetery.config.json

{
  "github_token": null,
  "target_org": "microsoft",
  "scan_interval": 3600,
  "auto_start": false
}
```

### 命令行参数

```bash
cargo tauri dev -- --scan    # 启动后自动扫描
cargo tauri dev -- --help     # 查看帮助
```

---

## 🛠️ 开发

### 添加新命令

```rust
// src-tauri/src/main.rs

#[tauri::command]
pub fn my_command(arg: String) -> String {
    format!("收到: {}", arg)
}

// 注册到 invoke_handler
.invoke_handler(tauri::generate_handler![
    get_stats,
    get_recent_corpses,
    trigger_scan,
    send_report,
    my_command  // 新增
])
```

### 前端调用

```javascript
const result = await invoke('my_command', { arg: 'hello' })
console.log(result)
```

### 添加依赖

```bash
# Rust 依赖
cd src-tauri
cargo add <package_name>

# NPM 依赖
npm install <package_name>
```

---

## 📱 系统集成

### macOS

- **托盘图标**: 菜单栏常驻，点击显示主窗口
- **开机自启**: 支持通过设置启用
- **右键菜单**: 显示操作选项

### Windows

- **系统托盘**: 任务栏右下角图标
- **开机自启**: 注册表集成

### Linux

- **AppIndicator**: 系统托盘支持
- **Desktop Entry**: 程序菜单集成

---

## 🎨 界面预览

```
┌─────────────────────────┐
│     🪦 Code Corpses    │
│   代码墓地监控         │
├─────────────────────────┤
│  📊 127    🧟 3         │
│  🔄 5分钟前  ⭐ 4.2k    │
├─────────────────────────┤
│  ┌───────────────────┐ │
│  │ 🔍 扫描墓地        │ │
│  └───────────────────┘ │
│  ┌───────────────────┐ │
│  │ ⚙️ 设置           │ │
│  └───────────────────┘ │
│  ┌───────────────────┐ │
│  │ 📤 发送报告        │ │
│  └───────────────────┘ │
├─────────────────────────┤
│ 📜 最新墓碑             │
│ ┌─────────────────────┐│
│ │ 🧟 vue2-admin       ││
│ │ 💀 8个月无更新 ⭐892 ││
│ └─────────────────────┘│
│ ┌─────────────────────┐│
│ │ 🧟 regex-validator   ││
│ │ 💀 2周无更新 ⭐128   ││
│ └─────────────────────┘│
├─────────────────────────┤
│ 🪦 代码千古事...        │
└─────────────────────────┘
```

---

## 📦 构建产物

构建完成后，产物位于:

```bash
# macOS
src-tauri/target/release/bundle/dmg/Code_Corpses_*.dmg
src-tauri/target/release/bundle/macos/Code Corpses.app

# Windows
src-tauri/target/release/bundle/msi/Code Corpses_*.msi

# Linux
src-tauri/target/release/bundle/deb/code-corpses_*.deb
```

---

## 🤝 贡献

欢迎贡献代码！

```bash
# 1. Fork 本项目
# 2. 创建特性分支
git checkout -b feature/amazing-feature

# 3. 提交改动
git commit -m 'Add amazing feature'

# 4. 推送分支
git push origin feature/amazing-feature

# 5. 提交 Pull Request
```

---

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Tauri](https://tauri.app/) - 构建框架
- [Octocrab](https://github.com/XAMPPRocky/octocrab) - GitHub API 客户端
- [Vite](https://vitejs.dev/) - 构建工具

---

**🪦 代码千古事，得失寸心知**
