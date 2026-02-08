# 🪦 程序员墓地 - Programmer Cemetery

> *"每一个被删除的 commit，都是对代码的一次缅怀。"*

![墓地状态](https://img.shields.io/badge/status-诈尸中-purple?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-v16+-green?style=for-the-badge)
![Version](https://img.shields.io/badge/version-v2.0.0-诈尸版-red?style=for-the-badge)

---

## 💀 这是什么鬼项目？

**程序员墓地** —— 专门给那些"死掉"的代码建坟立碑的墓地管理系统。

每一个被删除的 commit、每一个被废弃的功能、每一次"我们不用这个了"，都是一座墓碑。

> ⚠️ **警告**: 进入此墓地后，你可能会想起那些不堪回首的代码黑历史。

---

## ✨ 特性（诈尸版 v2.0）

| 特性 | 描述 | 诈尸指数 |
|------|------|---------|
| 🎲 **每日扫墓** | 每天随机展示一个"死亡"代码的故事 | 🪦 |
| 📊 **墓地统计** | 统计代码存活时间、死亡原因等 | 📈 |
| 🎂 **忌日提醒** | 死掉的日子会提醒你"缅怀" | 🕯️ |
| 🔄 **诈尸检测** | 某些墓碑可以点击"复活" | 🧟 |
| 🎁 **彩蛋模式** | 找到特定墓碑会有惊喜 | 🥚 |

---

## 🚀 快速开始（3秒上手）

### 方法1：直接运行（推荐）

```bash
# 克隆并运行
git clone https://github.com/stbz/programmer-cemetery.git
cd programmer-cemetery
npx ts-node programmer-cemetery.ts --visit
```

### 方法2：全局安装

```bash
npm install -g programmer-cemetery
cemetery --visit
```

### 方法3：Docker 扫墓（精神层面）

```bash
docker run --rm -it ghcr.io/stbz/programmer-cemetery:latest --visit
```

---

## 🎮 命令手册

### 基础扫墓

```bash
# 🎲 随机访问一个墓碑（每日推荐）
cemetery --visit

# 📊 查看墓地统计数据
cemetery --stats

# 🎂 查看今日忌日的墓碑
cemetery --anniversary
```

### 高级操作

```bash
# 🔄 检测墓碑能否复活
cemetery --resurrect <id>

# 🎁 触发彩蛋
cemetery --egg REFACTOR    # 🔄 诈尸彩蛋
cemetery --egg LEGACY      # 👴 老兵彩蛋
cemetery --egg TODO        # 📝 摸鱼彩蛋
cemetery --egg DOCS        # 📚 文档彩蛋
```

### 设置每日自动扫墓（摸鱼神器）

```bash
# 每天早上 9 点自动扫墓（顺便摸鱼）
0 9 * * * /usr/local/bin/cemetery --visit
```

---

## 🪦 今日墓碑预览

```
🪦 今日扫墓
────────────────────────────────────────────────--

🎭 RegEx 验证码解析器
   💀 死因: 被产品改成了滑块验证
   ⏰ 享年: 2周
   📜 墓志铭: "它曾经能识别99%的验证码，直到验证码学会了自我进化"
   👮 凶手: 前端负责人Peter
   📅 忌日: 2024-03-15

🪦 最老墓碑: JQuery 分支 (12年) - RIP
```

---

## 🎯 使用场景

- ✅ 团队代码复盘会议的"鞭尸"环节
- ✅ 技术分享会的"黑历史"专场
- ✅ 纪念那些"差一点就上线"的功能
- ✅ 记录职业生涯中的"翻车"现场
- ✅ 单纯想给代码立个碑
- ✅ 招聘面试时吓跑候选人

---

## 🤝 如何贡献"墓碑"

想给你的代码也立个碑？请遵循以下仪式：

### 添加新墓碑的步骤

1. **Fork** 本仓库（给代码办一场法事）
2. **创建分支**: `git checkout -b add-my-tombstone`
3. **在 `cemetery` 数组中添加新的墓碑对象**:

```typescript
{
  id: "unique-id",                    // 墓碑ID（要独一无二）
  name: "墓碑名称",                    // 死者姓名
  causeOfDeath: "死亡原因",            // 怎么死的
  age: "存活时间",                     // 活了多久
  epitaph: "墓志铭",                   // 临终遗言
  killedBy: "凶手",                    // 谁杀的
  dateOfDeath: "YYYY-MM-DD",          // 忌日
  category: "feature" | "project" | "experiment" | "joke",
  复活概率: 0-100,                     // 诈尸概率
  emoji: "🎭"                          // 墓碑表情
}
```

4. **提交**: `git commit -m '🪦 添加 XXX 墓碑 - R.I.P.'`
5. **推送**: `git push origin add-my-tombstone`
6. **提交 PR**: 等我来给你"收尸"

### 贡献者精神

> *"我在这里埋过代码，你呢？"*

---

## 🎉 彩蛋代码（找到就是赚到）

| 代码 | 彩蛋内容 | 稀有度 |
|------|---------|--------|
| `REFACTOR` | 🔄 诈尸了！这个功能被重构后在新版本复活了 | ⭐⭐ |
| `LEGACY` | 👴 老兵不死，只是慢慢凋零 | ⭐⭐⭐ |
| `TODO` | 📝 墓志铭写着"TODO: 以后做"，然后就没有以后了 | ⭐ |
| `DOCS` | 📚 文档比代码活得久系列 | ⭐⭐ |
| `DELETE` | 🗑️ 等等！我还没死！ | ⭐⭐⭐⭐ |
| `GHOST` | 👻 墓碑：用户说"我看不到bug"，然后产品说"加急" | ⭐⭐⭐⭐⭐ |

---

## 📦 项目结构

```
programmer-cemetery/
├── .gitignore              # 别把骨灰盒 .gitignore
├── LICENSE                 # 墓地地契
├── README.md               # 墓碑使用说明书
├── package.json           # 法器清单
└── programmer-cemetery.ts  # 骨灰盒（主程序）
```

---

## 🐛 Bug 报告

如果发现：
- ❌ 墓碑死而复生
- ❌ 诈尸失败
- ❌ 彩蛋不生效

请提交 [Issue](https://github.com/stbz/programmer-cemetery/issues)

> ⚠️ **注意**: 本项目不保证诈尸成功率，诈尸失败属于正常现象。

---

## 📜 LICENSE

MIT License - 详见 [LICENSE](LICENSE) 文件。

> "代码千古事，得失寸心知。"

---

## 💀 Rest in Peace

```
   _   _   _   _   _   _   _   _   _   _   _   _
  / \ / \ / \ / \ / \ / \ / \ / \ / \ / \ / \
 | 死 | 的 | 是 | 代 | 码 | ， | 永 | 存 | 的 | 是 |
  \_/ \_/ \_/ \_/ \_/ \_/ \_/ \_/ \_/ \_/ \_/
```

---

**程序员的墓碑不是结局，而是下一段代码的开始。** 🪦

---

<p align="center">
  <img src="https://img.shields.io/badge/诈尸-v2.0.0-purple?style=for-the-badge" />
  <img src="https://img.shields.io/badge/摸鱼-完成-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/立碑-成功-green?style=for-the-badge" />
</p>
