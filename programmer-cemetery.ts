/**
 * 🪦 程序员墓地 - 纪念那些"死掉"的代码
 * 
 * 每一个被删除的commit、每一个被废弃的功能、
 * 每一次"我们不用这个了"，都是一座墓碑
 * 
 * 特性：
 * - 🎲 每日随机"扫墓" - 每天给你看一个故事
 * - 📊 墓地统计 - 你的代码活了多少天
 * - 🎂 忌日提醒 - 死掉的日子会提醒你"缅怀"
 * - 🔄 偶尔诈尸 - 某些墓碑能点"复活"
 * - 🎁 彩蛋模式 - 找到特定墓碑会有惊喜
 */

interface Tombstone {
  id: string
  name: string
  causeOfDeath: string
  age: string          // 代码存活时间
  epitaph: string      // 墓志铭
  killedBy: string     // 凶手
  dateOfDeath: string
  category: 'feature' | 'project' | 'experiment' | 'joke'
 复活概率: number      // 0-100%，可能诈尸
  emoji: string
}

// 🎲 今日墓碑（随机展示）
const todayTombstone = (): Tombstone => {
  return cemetery[Math.floor(Math.random() * cemetery.length)]
}

// 📊 墓地统计
const cemeteryStats = () => {
  const total = cemetery.length
  const avgAge = cemetery.reduce((acc, t) => acc + parseAge(t.age), 0) / total
  const topKillers = [...new Set(cemetery.map(t => t.killedBy))].length
  
  return {
    total,
    avgAgeDays: Math.round(avgAge),
    uniqueKillers: topKillers,
    oldest: cemetery.reduce((a, b) => parseAge(a.age) > parseAge(b.age) ? a : b),
    newest: cemetery.reduce((a, b) => new Date(a.dateOfDeath) > new Date(b.dateOfDeath) ? a : b)
  }
}

// 🎂 忌日提醒
const deathAnniversary = (daysBefore: number = 7): Tombstone[] => {
  const today = new Date()
  return cemetery.filter(t => {
    const deathDate = new Date(t.dateOfDeath)
    const diffTime = deathDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= -daysBefore && diffDays <= 0
  })
}

// 🔄 诈尸检测（复活彩蛋）
const canResurrect = (id: string): boolean => {
  const tomb = cemetery.find(t => t.id === id)
  return tomb ? Math.random() * 100 < tomb.复活概率 : false
}

// 🎁 彩蛋墓碑（特殊ID触发）
const easterEgg = (code: string): string | null => {
  const eggs: Record<string, string> = {
    'REFACTOR': '🔄 诈尸了！这个功能被重构后在新版本复活了',
    'LEGACY': '👴 老兵不死，只是慢慢凋零',
    'TODO': '📝 墓志铭写着"TODO: 以后做"，然后就没有以后了',
    'DOCS': '📚 文档比代码活得久系列',
  }
  return eggs[code] || null
}

// 辅助函数
const parseAge = (age: string): number => {
  const num = parseInt(age)
  if (age.includes('年')) return num * 365
  if (age.includes('月')) return num * 30
  if (age.includes('周')) return num * 7
  return num
}

// 🎮 CLI 交互
const args = process.argv.slice(2)
const command = args[0]

switch (command) {
  case '--visit':
    const tomb = todayTombstone()
    console.log(`\n🪦 今日扫墓`)
    console.log('─'.repeat(50))
    console.log(`\n${tomb.emoji} ${tomb.name}`)
    console.log(`   💀 ${tomb.causeOfDeath}`)
    console.log(`   ⏰ 享年: ${tomb.age}`)
    console.log(`   📜 墓志铭: "${tomb.epitaph}"`)
    console.log(`   👮 凶手: ${tomb.killedBy}`)
    console.log(`   📅 忌日: ${tomb.dateOfDeath}\n`)
    break
    
  case '--stats':
    const stats = cemeteryStats()
    console.log(`\n📊 墓地统计`)
    console.log('─'.repeat(50))
    console.log(`   总墓碑数: ${stats.total}`)
    console.log(`   平均寿命: ${stats.avgAgeDays} 天`)
    console.log(`   凶手数量: ${stats.uniqueKillers} 人`)
    console.log(`   最老墓碑: ${stats.oldest.name} (${stats.oldest.age})`)
    console.log(`   最新墓碑: ${stats.newest.name} (${stats.newest.dateOfDeath})\n`)
    break
    
  case '--anniversary':
    const anniversaries = deathAnniversary()
    if (anniversaries.length > 0) {
      console.log(`\n🎂 今日忌日提醒`)
      console.log('─'.repeat(50))
      anniversaries.forEach(t => {
        console.log(`   ${t.emoji} ${t.name} - ${t.dateOfDeath}`)
      })
    } else {
      console.log(`\n✅ 今天没有墓碑忌日，安心写代码吧\n`)
    }
    break
    
  case '--resurrect':
    const id = args[1]
    if (canResurrect(id)) {
      console.log(`\n🎉 诈尸啦！${id} 可能要复活了！`)
    } else {
      console.log(`\n💀 安息吧，这个墓碑不会再醒了`)
    }
    break
    
  case '--egg':
    const code = args[1]
    const egg = easterEgg(code)
    if (egg) {
      console.log(`\n🎁 彩蛋触发！${egg}`)
    }
    break
    
  case '--help':
  default:
    console.log(`
🪦 程序员墓地 - CLI 扫墓工具

用法: cemetery <命令>

命令:
  --visit        🎲 随机访问一个墓碑
  --stats        📊 查看墓地统计数据
  --anniversary  🎂 查看今日忌日的墓碑
  --resurrect <id>  🔄 检测墓碑能否复活
  --egg <code>    🎁 触发彩蛋

示例:
  cemetery --visit
  cemetery --stats
  cemetery --anniversary

💡 每日自动运行:
  0 9 * * * /usr/local/bin/cemetery --visit  # 每天早上9点扫墓
    `)
}

const cemetery: Tombstone[] = [
  {
    id: "regex-validator",
    name: "RegEx 验证码解析器",
    causeOfDeath: "被产品改成了滑块验证",
    age: "2周",
    epitaph: "它曾经能识别99%的验证码，直到验证码学会了自我进化",
    killedBy: "前端负责人Peter",
    dateOfDeath: "2024-03-15",
    category: "experiment",
    复活概率: 5,
    emoji: "🎭"
  },
  {
    id: "microservice-x",
    name: "微服务X部署脚本",
    causeOfDeath: "整个服务被废弃了",
    age: "3个月",
    epitaph: "写了200行Bash脚本，就为了省下5分钟的docker compose up",
    killedBy: "架构师Dave",
    dateOfDeath: "2024-05-20",
    category: "project",
    复活概率: 0,
    emoji: "🐳"
  },
  {
    id: "vue2-admin",
    name: "Vue 2.0 管理系统",
    causeOfDeath: "Vue 3发布了",
    age: "8个月",
    epitaph: "RIP Composition API，Options API永不为奴！",
    killedBy: "尤雨溪",
    dateOfDeath: "2023-01-07",
    category: "project",
    复活概率: 10,
    emoji: "📰"
  },
  {
    id: "internal-wiki",
    name: "内部Wiki系统",
    causeOfDeath: "没人写文档",
    age: "1年",
    epitaph: "它的墓志铭是空的，因为没人愿意写",
    killedBy: "全团队",
    dateOfDeath: "2024-08-01",
    category: "project",
    复活概率: 0,
    emoji: "📖"
  },
  {
    id: "jquery-branch",
    name: "JQuery 分支",
    causeOfDeath: "IE11终于死了",
    age: "12年",
    epitaph: "IE6比它晚死，我佛了",
    killedBy: "微软自己",
    dateOfDeath: "2022-06-15",
    category: "feature",
    复活概率: 0,
    emoji: "⚰️"
  },
  {
    id: "todo-feature",
    name: "TODO功能",
    causeOfDeath: "TODO太多，做不完",
    age: "6个月",
    epitaph: "// TODO: 以后做 = 永远不做",
    killedBy: "开发者自己",
    dateOfDeath: "2024-01-01",
    category: "joke",
    复活概率: 50,
    emoji: "📝"
  }
]
