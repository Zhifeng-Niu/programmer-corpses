# 🎉 Code Corpses 新增功能说明

## 📦 新增文件

### 1. 🧟 enhanced-zombie.ts - 增强版诈尸检测系统

**位置：** `src/enhanced-zombie.ts`

**核心功能：**
- 🎯 多种检测算法（精确匹配、模糊匹配、结构分析）
- 📊 相似度评分（Jaro-Winkler 字符串相似度、内容相似度、结构相似度）
- 🏷️ 自动分类复活类型
- 🔍 支持从 GitHub 和本地文件加载墓地数据
- 📝 生成详细的诈尸报告

**复活类型分类：**
- `CLONE` - 🔄 完全克隆（相似度 > 90%）
- `REFACTOR` - 🔨 重构改进（相似度 > 75%）
- `MODULARIZE` - 📦 模块化提取（相似度 > 60%）
- `AI_DERIVED` - 🧠 AI 派生
- `INSPIRED` - 💡 灵感参考

**使用方法：**
```bash
# 扫描仓库检测诈尸
npx ts-node src/enhanced-zombie.ts scan my-repo

# 保存报告到 enhanced-zombie-report.md
```

---

### 2. 🪦 tombstone-generator.ts - 墓碑生成器

**位置：** `src/tombstone-generator.ts`

**核心功能：**
- 🎨 6 种精美墓碑风格
- 📊 自动生成统计信息（文件数、行数、大小）
- 🏷️ 支持标签和作者信息
- 💾 批量生成墓碑
- 📄 保存到文件

**6种墓碑风格：**
1. **CLASSIC** - 🪦 经典墓碑样式
2. **MODERN** - 🎨 现代简约设计
3. **EMOJI** - 😀 Emoji 风格
4. **ASCII** - 💻 ASCII 艺术
5. **MINIMAL** - ⬜ 极简主义
6. **CYBERPUNK** - 🌆 赛博朋克风格

**使用方法：**
```bash
# 生成墓碑
npx ts-node src/tombstone-generator.ts generate ./old-code my-repo "代码太老了"

# 预览所有风格
npx ts-node src/tombstone-generator.ts preview

# 自定义风格
# 修改代码中的 TombstoneConfig 配置
```

---

### 3. 🏛️ cemetery-search.ts - 墓地搜索引擎

**位置：** `src/cemetery-search.ts`

**核心功能：**
- 🔍 多种搜索方式（精确、模糊、标签、语义、作者）
- 📊 智能排序（相关度、日期、星标、大小、随机）
- 🎲 随机浏览功能
- 🔥 热门墓碑榜单
- 💡 智能推荐
- 📈 统计分析

**搜索类型：**
- `EXACT_MATCH` - 🎯 精确匹配
- `FUZZY_MATCH` - 🔍 模糊匹配（Levenshtein 距离）
- `TAG_MATCH` - 🏷️ 标签匹配
- `SEMANTIC_MATCH` - 🧠 语义匹配
- `AUTHOR_MATCH` - 👮 作者匹配

**使用方法：**
```bash
# 搜索
npx ts-node src/cemetery-search.ts search auth utils

# 随机浏览
npx ts-node src/cemetery-search.ts random 5

# 热门墓碑
npx ts-node src/cemetery-search.ts trending 10

# 统计信息
npx ts-node src/cemetery-search.ts stats

# 智能推荐
npx ts-node src/cemetery-search.ts recommend "用户认证"
```

---

## 🖥️ 菜单栏应用更新

**文件：** `menu-bar/src-tauri/src/main.rs`

### 新增功能：诈尸提醒系统

**新增数据结构：**
```rust
pub struct ZombieAlert {
    pub id: String,
    pub corpse_repo: String,
    pub corpse_path: String,
    pub zombie_repo: String,
    pub zombie_path: String,
    pub similarity: f64,
    pub resurrection_type: String,
    pub confidence: f64,
    pub detected_at: String,
    pub notified: bool,
}

pub struct ZombieAlerts {
    pub alerts: Vec<ZombieAlert>,
    pub last_check: String,
    pub total_alerts: usize,
    pub unread_count: usize,
}
```

**新增 Tauri 命令：**
- `get_zombie_alerts()` - 获取诈尸提醒列表
- `add_zombie_alert()` - 添加诈尸提醒
- `mark_alert_read()` - 标记为已读
- `clear_all_alerts()` - 清除所有提醒
- `check_zombie_resurrection()` - 检测诈尸（可配合前端调用）

**功能特性：**
- 🔔 系统通知提醒
- 📊 未读计数
- 💾 持久化存储
- 🧪 模拟检测功能（可替换为真实检测逻辑）

---

## 📦 package.json 更新

**新增脚本命令：**
```json
{
  "enhanced-detect": "npx ts-node src/enhanced-zombie.ts scan",
  "tombstone": "npx ts-node src/tombstone-generator.ts",
  "search": "npx ts-node src/cemetery-search.ts"
}
```

**使用方式：**
```bash
npm run enhanced-detect my-repo
npm run tombstone generate ./old-code my-repo "原因"
npm run tombstone preview
npm run search auth utils
npm run search random
npm run search trending
npm run search stats
```

---

## 📖 README.md 更新

**新增内容：**
1. 功能列表中添加了 3 个新功能
2. 命令使用示例更新
3. 命令说明表格更新
4. 新增 3 个详细功能说明章节

---

## 🎯 使用场景示例

### 场景 1：检测新项目是否使用了旧代码

```bash
# 1. 运行增强版诈尸检测
npm run enhanced-detect my-new-project

# 2. 查看报告
cat enhanced-zombie-report.md

# 输出示例：
# 🧟 诈尸检测报告
# 发现 2 个诈尸案例:
# 1. src/utils/regex.ts → packages/core/src/regex.ts (85% 相似度)
# 2. src/auth.ts → libs/auth/src/index.ts (72% 相似度)
```

### 场景 2：为废弃代码生成精美墓碑

```bash
# 1. 生成墓碑
npm run tombstone generate ./deprecated my-repo "功能已迁移"

# 2. 选择喜欢的风格
# 修改 tombstone-generator.ts 中的 style 配置

# 3. 查看生成的墓碑
cat tombstones/my-repo-xxxxx.md
```

### 场景 3：在墓地中搜索可复用代码

```bash
# 1. 搜索特定功能
npm run search "user authentication"

# 2. 查看结果
# 输出匹配的墓碑列表，包含相关度评分

# 3. 浏览热门墓碑找灵感
npm run search trending
```

### 场景 4：菜单栏监控诈尸

```bash
# 1. 启动菜单栏应用
cd menu-bar && cargo tauri dev

# 2. 点击"检测诈尸"按钮
# 应用会自动检测并显示通知

# 3. 查看诈尸提醒列表
# 可以看到所有检测到的诈尸案例
```

---

## 🔧 技术栈

### 核心技术
- **TypeScript** - 主要开发语言
- **Node.js** - 运行环境
- **Octokit** - GitHub API 客户端
- **Tauri** - 菜单栏应用框架
- **Rust** - 菜单栏后端

### 算法
- **Jaro-Winkler** - 字符串相似度
- **Levenshtein** - 编辑距离
- **Token-based** - 内容相似度
- **AST-based** - 结构相似度（待实现）

---

## 🚀 未来扩展

### 可能的改进
1. **AI 集成**
   - 使用 OpenAI API 进行语义分析
   - 代码功能自动标注
   - 智能推荐

2. **Web UI**
   - 墓地可视化浏览
   - 交互式搜索
   - 实时诈尸监控

3. **更多墓碑风格**
   - 象形文字风格
   - 像素艺术风格
   - 3D 墓碑

4. **社区功能**
   - 分享墓碑到社区
   - 点赞和评论
   - 墓地排行榜

---

## 📝 注意事项

1. **GitHub Token 限制**
   - 未配置 Token 时使用模拟数据
   - 建议配置 Token 以获得完整功能

2. **文件扫描限制**
   - 大仓库扫描可能较慢
   - 建议设置合理的文件过滤规则

3. **墓碑存储**
   - 默认保存在本地文件系统
   - 可扩展为 GitHub 仓库存储

---

## 🤝 贡献

欢迎提交 PR 和 Issue！

**特别感谢：**
- 所有为代码墓地贡献的程序员们
- 让代码"死得其所"的每一个 commit

---

**一起让代码尸体们死得其所，活得精彩！** 🪦💪
