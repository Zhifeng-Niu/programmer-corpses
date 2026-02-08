# 🌐 Code Corpses 全环境集成指南

> *墓地无处不在，快乐随手可得* 🪦

---

## 📦 安装方式

### 🟢 npm（推荐）

```bash
npm install -g code-corpses
code-corpses --visit
```

### 🐳 Docker

```bash
# 直接运行
docker run --rm -it ghcr.io/zhifeng-niu/code-corpses:latest --visit

# 或构建自己的镜像
docker build -t my-cemetery .
docker run --rm -it my-cemetery --stats
```

### 🐍 Python (Coming Soon)

```bash
pip install code-corpses
code-corpses --visit
```

### 🍺 Homebrew

```bash
brew install code-corpses
```

---

## 🤖 AI Agent 集成

### Claude Code / MCP

```bash
# 1. 安装 MCP Server
npm install -g code-corpses-mcp

# 2. 配置 Claude Code
# 复制 integrations/claude-code.json 到 ~/.claude/

# 3. 对 Agent 说：
# "帮我检查一下死代码"
# "生成一个墓碑"
```

### OpenAI GPTs

```bash
# 部署为 Web API（见下文）
# 配置 GPT Actions 调用 API
```

---

## ☁️ Cloud 部署

### GitHub Actions（推荐）

```yaml
# .github/workflows/cemetery.yml
name: 🪦 Code Corpses Scan
on:
  schedule:
    - cron: '0 9 * * 1'  # 每周一扫描
  workflow_dispatch:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 🕵️ Run Code Corpses
        run: |
          npm install -g code-corpses
          code-corpses scan --repo .
```

### Cloudflare Worker

```bash
# 部署为无服务器函数
npx wrangler deploy integrations/api.ts
```

### AWS Lambda

```bash
# 打包为 Lambda Layer
zip -r layer.zip src/
aws lambda publish-layer-version ...
```

---

## 💻 IDE 集成

### VS Code Extension

```json
// extensions.json
{
  "recommendations": ["zhifeng-niu.code-corpses"]
}
```

### JetBrains IDE

```bash
# Plugin 开发中...
# 预计支持：IDEA, PyCharm, WebStorm
```

---

## 🔧 CI/CD 集成

### GitLab CI

```yaml
cemetery_scan:
  image: node:18-alpine
  script:
    - npm install -g code-corpses
    - code-corpses scan --repo .
  artifacts:
    paths: [cemetery-report.md]
```

### CircleCI

```yaml
workflows:
  cemetery:
    jobs:
      - scan-code
```

---

## 📡 API 部署

### 一键部署

```bash
# Vercel
vercel --prod integrations/api.ts

# Railway
railway up integrations/api.ts

# Render
render deploy --config integrations/render.yaml
```

### 本地运行

```bash
npm install express cors
node integrations/api.js
# API: http://localhost:3000
```

---

## 📱 通知渠道

### Telegram Bot

```bash
export TELEGRAM_TOKEN=xxx
export TELEGRAM_CHAT_ID=xxx
code-corpses scan --notify telegram
```

### Discord Webhook

```bash
export DISCORD_WEBHOOK=xxx
code-corpses scan --notify discord
```

### Slack App

```bash
export SLACK_TOKEN=xxx
code-corpses scan --notify slack
```

---

## 🎯 快速集成模板

### Node.js 项目

```bash
# 1. 安装
npm install --save-dev code-corpses

# 2. package.json 添加脚本
{
  "scripts": {
    "cemetery": "code-corpses",
    "scan": "code-corpses scan --repo ."
  }
}

# 3. CI 中运行
npm run scan
```

### Python 项目

```bash
# 1. 安装
pip install code-corpses

# 2. CI 中运行
code-corpses scan --repo .
```

### Shell 脚本

```bash
#!/bin/bash
# 每天早上9点扫描

# 安装
npm install -g code-corpses

# 扫描
code-corpses scan --repo . \
  --output cemetery-report-$(date +%Y%m%d).md \
  --notify telegram

# 清理旧报告
find . -name "cemetery-report-*.md" -mtime +30 -delete
```

---

## 🔐 配置管理

### 环境变量

```bash
# GitHub Token
export GH_TOKEN=ghp_xxxxx

# 扫描阈值（天）
export CORPSE_THRESHOLD=90

# 通知渠道
export NOTIFY_CHANNEL=telegram

# 墓地路径
export CEMETERY_PATH=./cemetery
```

### 配置文件

```yaml
# cemetery.config.yaml
cemetery:
  enabled: true
  scan_interval: weekly
  dead_threshold_days: 90
  auto_archive: false

notifications:
  channel: telegram
  events:
    new_corpse: true
    zombie_alert: true
    weekly_report: true
```

---

## 📖 使用示例

### 基础使用

```bash
# 🎲 随机扫墓
code-corpses --visit

# 📊 查看统计
code-corpses --stats

# 🕵️ 扫描项目
code-corpses scan --repo my-project

# 🧟 检测诈尸
code-corpses detect --keywords "util auth"
```

### Agent 使用

```
你：Agent，检查一下这个项目有没有死代码

Agent：好嘞！
      运行 code-corpses scan --repo .
      发现 3 具尸体...
      已生成墓碑报告
      
      💀 第一具：utils/auth.js - 90天没人改
      💀 第二具：components/OldButton.vue - 重组后不用了
      💀 第三具：tests/legacy.test.js - 功能已移除

你：帮我归档第一个
Agent：OK，code-corpses archive utils/auth.js
      ✅ 已归档到墓地
```

---

## 🤝 贡献集成

想要支持新平台？提交 PR！

```bash
# 添加新集成
mkdir integrations/new-platform
# 添加 README + 配置 + 示例
# 提交 PR
```

---

**墓地无处不在，快乐随手可得** 🪦🌍

---

*💡 提示：集成越多，快乐越多！*
