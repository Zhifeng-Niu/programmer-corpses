# 🪦 Code Corpses - 代码墓地

> *"死代码不是终点，是等 AI 翻牌子的轮回中转站"* 🧟♂️

[![Vibe: Happy Coding](https://img.shields.io/badge/vibe-Happy%20Coding-purple?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)]()
[![Node](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge)]()

---

## 💀 这是什么鬼？

**AI 时代代码太多了，写完就丢，丢哪儿？**

丢进 **代码墓地** 🪦

- 📦 你不管的代码 → AI 自动扫描 → 丢进墓地
- 🔍 新项目需要功能 → AI 去墓地翻一翻 → 诈尸复用
- 🧟 死掉的代码不是真死，只是等 AI 来捞

> **核心哲学：** 墓地不是终点，是代码的"轮回中转站"

---

## 🎯 名字的生前遗书

| 版本 | 名字 | 死因 |
|------|------|------|
| v1.0 | 🪦 **programmer-cemetery** | "程序员"限定太窄，谁还没丢过代码 |
| v2.0 | 🪦 **programmer-corpses** | "墓地"太忌讳，但"尸体"够直白 |
| v3.0 | 🪦 **code-corpses** | 名字不重要，开心最重要 😄 |
| v4.0 | 🪦 **Universal AI 模块** | 任何 AI 都能用，开心开心开心！ |

> RIP 所有曾经的名字 —— 它们在 git log 里永垂不朽 ✨

---

## ✨ 我们做什么

| 功能 | 做什么 | 快乐指数 |
|------|--------|---------|
| 🤖 **AI 自动扫描** | 90天没动的代码 → 自动标记 | 🧠 |
| 📦 **统一资产索引** | 代码/文本/模板/想法 → 全都管 | 📦 |
| 🪦 **墓碑生成器** | 死代码立碑 → 墓志铭+标签 | 🪦 |
| 🧟 **诈尸检测器** | 旧代码被新项目复用 → 通知你 | 🧟 |
| 🔍 **智能搜索** | 墓地里翻一翻 → 找到可用代码 | 🔎 |
| 📊 **仪表板** | 一眼看穿你的代码墓地 | 📈 |
| 🌐 **通用接口** | 任何 AI 都能调用 | 🤖 |

---

## 🚀 四种玩法

### 1️⃣ REST API (最通用)

随便一个能发 HTTP 请求的都能用：

```bash
# 启动墓地服务器
npm run serve:api

# 看看你杀了多少代码
curl http://localhost:3000/api/summary

# 墓地淘宝
curl "http://localhost:3000/api/search?q=auth"

# 给代码办葬礼
curl -X POST http://localhost:3000/api/tombstone \
  -H "Content-Type: application/json" \
  -d '{"path": "./src/old-module.ts", "cause": "没人爱了"}'
```

### 2️⃣ MCP Server (Claude Code 专属 🎉)

Claude Code 用户的快乐：

```bash
# 启动 MCP Server
npm run serve:mcp

# Claude 就能调用墓地工具了！
# "帮我看看这段代码死了没"
# "把那个老模块埋了"
```

**可用工具：**
- `analyze_code` - 这段代码凉了吗？
- `create_tombstone` - 办葬礼！
- `detect_zombie` - 诈尸检测 🧟
- `search_cemetery` - 墓地淘宝
- `visit_tombstone` - 随机看墓碑故事

### 3️⃣ OpenAI Functions (GPT-4 专属)

GPT 也能玩墓地：

```typescript
// 配置好函数定义后
"帮我分析 ./src/dead-code.ts 死了没"
"把那个 auth 模块埋了，原因是太老了"
```

### 4️⃣ CLI (人类专用 👋)

```bash
# 索引你的代码
cemetery index --path ./my-project

# 分析代码是否已死
cemetery analyze ./src/old-module.ts

# 创建墓碑
cemetery tombstone --create ./src/dead.ts --cause "deprecated"

# 墓地淘宝
cemetery search auth

# 统计你杀了多少代码
cemetery stats

# 随机看一个墓碑故事
cemetery visit
```

---

## 🎮 怎么玩

### 方式 A：让 AI 当墓地管理员

```yaml
# .coderagerc
cemetery:
  enabled: true
  scan_interval: weekly
  dead_threshold_days: 90
  auto_archive: true
  notify: telegram
```

AI 自动：
- 每周扫描 → 找到死代码 → 生成墓碑
- 检测诈尸 → 旧代码被复用 → 通知你
- 统计报告 → 发送到你的渠道

### 方式 B：手动扫墓（摸鱼用）

```bash
# 随机看一个墓碑故事
cemetery visit

# 看看你杀了多少代码
cemetery stats

# 今天有代码忌日吗
cemetery anniversary

# 彩蛋时间
cemetery egg REFACTOR
```

---

## 📦 快速开始

### 1. 装一下

```bash
npm install -g code-corpses
```

### 2. 开始丢人...不对，索引代码

```bash
# 索引当前目录
cemetery index --path .

# 或启动 API 服务器
npm run serve:api
```

### 3. 开始你的表演

```bash
cemetery dashboard   # 看看你的数字墓地
cemetery start       # 启动自动扫描
cemetery stop        # 停止
```

---

## 🏗️ 项目结构

```
programmer-corpses/
├── src/
│   ├── cli.ts                    # CLI 入口
│   ├── core/
│   │   ├── interfaces.ts         # 🌟 统一接口定义
│   │   ├── analyzer.ts          # 🤖 代码分析器
│   │   └── ...                   # 更多核心模块
│   ├── adapters/
│   │   ├── mcp-server.ts        # 🤖 MCP Server
│   │   ├── openai-functions.ts  # 🎯 OpenAI Functions
│   │   └── rest-api.ts          # 🌐 REST API
│   ├── asset-index.ts           # 📦 统一资产索引
│   ├── tombstone-registry.ts   # 🪦 墓碑注册处
│   ├── dashboard.ts             # 📊 仪表板
│   └── auto-scanner.ts          # 🤖 自动扫描器
├── menu-bar/                    # 🍎 Menu Bar 应用
└── README.md                    # 你正在看的快乐文档
```

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

## 🎯 使用场景

| 场景 | 怎么玩 |
|------|--------|
| 分析代码是否已死 | `cemetery analyze ./src/old-module.ts` |
| 为死代码创建墓碑 | `cemetery tombstone --create ./src/dead.ts --cause "没人爱"` |
| 检测代码是否诈尸 | `cemetery detect-zombie ./src/new-code.ts` |
| 搜索墓地 | `cemetery search auth` |
| 获取统计摘要 | `cemetery dashboard` |
| 索引新目录 | `cemetery index --path ./my-project` |
| 随机访问墓碑 | `cemetery visit` |

---

## 🎉 哲学理念

> **Human Off the Loop: AI 自行运转，人类只看结果**

- ✅ 快乐编程 (Happy Vibe Coding) 😄
- ✅ 任何 AI 都能用 (Universal AI Module) 🤖
- ✅ 自动化优先 (Mostly automatic) ⚡
- ✅ 代码墓地即服务 (Cemetery as a Service) 🪦

---

## 🤝 一起开心

开源快乐，欢迎一起维护！

```bash
# 提 PR
# 提 Issue
# 或者只是来看看代码墓地又多了什么墓碑
```

**死代码不是尸体，是等着被 AI 翻牌子的潜力股！** 🪦💪

---

<p align="center">
  <img src="https://img.shields.io/badge/墓地-代码墓地-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/协议-MIT-green?style=for-the-badge" />
  <img src="https://img.shields.io/badge/状态-Happy%20Coding-purple?style=for-the-badge" />
  <img src="https://img.shields.io/badge/版本-Universal%20AI Module-yellow?style=for-the-badge" />
</p>
