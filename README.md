# 🪦 Code Corpses - 代码墓地 (Universal AI Capability Module)

> *"死代码不是终点，是等 AI 翻牌子的轮回中转站"* 🧟‍♂️

[![Vibe: Happy Coding](https://img.shields.io/badge/vibe-Happy%20Coding-purple?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)]()
[![Node](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge)]()

---

## 🎯 核心特性：通用 AI 能力模块

**让任何 AI Agent 都能使用代码墓地：Claude、GPT、OpenClaw、本地模型...**

```typescript
interface CemeteryCapability {
  analyzeCode(path: string): Promise<AnalysisResult>
  createTombstone(path: string, cause: string): Promise<Tombstone>
  detectZombie(newCode: string): Promise<ZombieResult>
  listAssets(filter?: AssetFilter): Promise<Asset[]>
  search(query: string): Promise<SearchResult[]>
  getSummary(): Promise<CemeterySummary>
}
```

---

## 🚀 四种使用方式

### 1️⃣ REST API (最通用)

```bash
# 启动 API 服务器
npm run serve:api

# API 端点
GET  /api/health          # 健康检查
GET  /api/summary         # 获取统计摘要
GET  /api/assets          # 列出资产
GET  /api/tombstones      # 列出墓碑
GET  /api/search?q=auth   # 搜索
POST /api/analyze         # 分析代码
POST /api/tombstone       # 创建墓碑
POST /api/detect-zombie   # 检测诈尸
POST /api/index           # 索引目录
```

**curl 示例：**
```bash
# 获取统计摘要
curl http://localhost:3000/api/summary

# 搜索代码
curl "http://localhost:3000/api/search?q=auth"

# 分析代码
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"path": "./src/old-module.ts"}'
```

### 2️⃣ MCP Server (Claude Code 专用)

```bash
# 启动 MCP Server
npm run serve:mcp

# Claude Code 配置
# 在 claude_code_mcp.json 中添加:
{
  "mcpServers": {
    "cemetery": {
      "command": "npx",
      "args": ["ts-node", "src/cli.ts", "serve", "mcp"]
    }
  }
}
```

**可用工具：**
- `analyze_code` - 分析代码是否已死
- `create_tombstone` - 为代码创建墓碑
- `detect_zombie` - 检测诈尸代码
- `list_assets` - 列出资产
- `search_cemetery` - 搜索墓地
- `get_summary` - 获取统计摘要
- `index_path` - 索引目录
- `visit_tombstone` - 随机访问墓碑

### 3️⃣ OpenAI Functions (GPT-4 专用)

```typescript
// 在你的 GPT 中配置函数定义
const functions = [
  {
    name: "cemetery_analyze_code",
    description: "分析代码是否已死...",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "代码路径" }
      }
    }
  },
  // ... 更多函数定义
]
```

### 4️⃣ CLI (人类专用)

```bash
# 索引目录
cemetery index --path ./src

# 分析代码
cemetery analyze ./src/old-module.ts

# 创建墓碑
cemetery tombstone --create ./src/dead.ts --cause "deprecated"

# 搜索
cemetery search auth

# 查看统计
cemetery stats
```

---

## 📦 快速开始

### 安装

```bash
npm install -g code-corpses
```

### 初始化墓地

```bash
# 索引当前目录
cemetery index --path .

# 或启动 API 服务器
npm run serve:api
```

---

## 🏗️ 项目结构

```
programmer-corpses/
├── src/
│   ├── cli.ts                    # CLI 入口 + 统一命令路由
│   ├── core/
│   │   ├── interfaces.ts         # 🌟 CemeteryCapability 接口定义
│   │   ├── analyzer.ts           # 🤖 代码分析器
│   │   ├── tombstone.ts          # 🪦 墓碑生成器
│   │   ├── zombie.ts             # 🧟 诈尸检测器
│   │   └── indexer.ts            # 📦 资产索引器
│   ├── adapters/
│   │   ├── mcp-server.ts         # 🤖 MCP Server 适配器
│   │   ├── openai-functions.ts   # 🎯 OpenAI Functions 适配器
│   │   └── rest-api.ts           # 🌐 REST API 适配器
│   ├── asset-index.ts            # 📦 统一资产索引
│   ├── tombstone-registry.ts     # 🪦 墓碑注册处
│   └── dashboard.ts              # 📊 仪表板生成器
├── menu-bar/                     # 🍎 Menu Bar 应用
├── package.json
└── README.md
```

---

## 🎮 核心命令

```bash
# 📦 索引资产
cemetery index --path ./my-project/src
cemetery index --github owner/repo

# 🪦 创建墓碑
cemetery tombstone --create ./src/old-auth.ts --cause "被新认证模块替代"

# 🔍 搜索
cemetery search auth
cemetery search "typescript utils"

# 📊 统计
cemetery stats
cemetery digest

# 🕵️ 分析
cemetery analyze ./src/old-module.ts
```

---

## 🎯 使用场景

| 场景 | AI Agent 使用方式 |
|------|------------------|
| 分析代码是否已死 | `analyze_code(path)` |
| 为死代码创建墓碑 | `create_tombstone(path, cause)` |
| 检测代码是否诈尸 | `detect_zombie(newCode)` |
| 搜索墓地 | `search_cemetery(query)` |
| 获取统计摘要 | `get_summary()` |
| 索引新目录 | `index_path(path)` |
| 随机访问墓碑 | `visit_tombstone()` |

---

## 🌐 菜单栏应用

```bash
# 开发模式
cd menu-bar
npm run dev

# 构建
cd menu-bar
npm run build
```

菜单栏显示：
- 🪦 总墓碑数
- 📦 存活资产
- 🧟 复活数量
- 📊 最近扫描时间

---

## 🎉 哲学理念

> **Human Off the Loop: AI works autonomously, humans only see results**

- ✅ 快乐编程 (Happy Vibe Coding)
- ✅ 即插即用 (Plug-and-play for any AI)
- ✅ 自动化优先 (Mostly automatic)
- ✅ 代码墓地即服务 (Cemetery as a Service)

---

**死代码不是尸体，是等着被 AI 翻牌子的潜力股！** 🪦💪

---

<p align="center">
  <img src="https://img.shields.io/badge/墓地-Universal%20AI-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/协议-MIT-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/状态-Happy%20Coding-purple?style=for-the-badge" />
</p>
