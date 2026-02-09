#!/usr/bin/env node

/**
 * 🪦 Code Corpses - 代码尸体集中营
 *
 * De-location Storage | Tombstone as Epitaph | Abstract Asset Layer
 * 不关心代码在哪，只关心它存在
 */

import * as fs from 'fs'
import * as path from 'path'

// 导入各模块
import { CodeCorpseScanner } from './scanner'
import { ZombieDetector } from './zombie'
import { CodeMortuary } from './mortuary'
import {
  indexDirectory,
  indexGitHubRepo,
  searchAssets,
  getStats as getAssetStats,
  listByType,
  loadIndex,
  saveIndex,
  AssetType,
} from './asset-index'
import {
  createTombstone,
  searchTombstones,
  listTombstones,
  formatTombstone,
  getRegistryStats,
} from './tombstone-registry'

// 墓碑数据 (legacy built-in data)
const cemetery = [
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

// 🎲 今日墓碑（随机展示）
const todayTombstone = () => {
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
const deathAnniversary = (daysBefore: number = 7): typeof cemetery => {
  const today = new Date()
  return cemetery.filter(t => {
    const deathDate = new Date(t.dateOfDeath)
    const diffTime = deathDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays >= -daysBefore && diffDays <= 0
  })
}

// 🔄 诈尸检测
const canResurrect = (id: string): boolean => {
  const tomb = cemetery.find(t => t.id === id)
  return tomb ? Math.random() * 100 < tomb.复活概率 : false
}

// 🎁 彩蛋墓碑
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

// ========== CLI 解析 ==========

function parseArgs(args: string[]): { command: string; subcommand?: string; flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {}
  const positional: string[] = []
  let command = args[0] || '--help'
  let subcommand: string | undefined

  // Handle subcommands like "index", "tombstone", "search", "assets"
  if (command && !command.startsWith('-')) {
    subcommand = args[1] && !args[1].startsWith('-') ? args[1] : undefined
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '')
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('--')) {
        flags[key] = nextArg
        i++
      } else {
        flags[key] = 'true'
      }
    } else if (i > 0 && (command === 'search' || command === 'index' || command === 'tombstone' || command === 'assets')) {
      if (i > 1 || (i === 1 && !subcommand)) {
        positional.push(arg)
      }
    }
  }

  return { command, subcommand, flags, positional }
}

// CLI 入口
const args = process.argv.slice(2)

async function main() {
  const parsed = parseArgs(args)
  const { command, subcommand, flags, positional } = parsed

  switch (command) {
    // ========== New Commands ==========

    case 'index': {
      const targetPath = flags['path']
      const githubRepo = flags['github']

      if (!targetPath && !githubRepo) {
        console.log(`
📦 cemetery index - 索引资产

用法:
  cemetery index --path <path>       索引本地目录
  cemetery index --github <repo>     索引 GitHub 仓库

示例:
  cemetery index --path ./src
  cemetery index --path /Users/me/projects/my-app
  cemetery index --github Zhifeng-Niu/programmer-corpses
  cemetery index --github https://github.com/owner/repo
        `)
        return
      }

      if (targetPath) {
        const fullPath = path.resolve(targetPath)
        if (!fs.existsSync(fullPath)) {
          console.log(`❌ 路径不存在: ${fullPath}`)
          return
        }
        console.log(`📂 索引 ${fullPath}...\n`)
        const assets = indexDirectory(fullPath)

        // Merge with existing
        const existing = loadIndex()
        const existingHashes = new Set(existing.map(a => a.hash))
        const newAssets = assets.filter(a => !existingHashes.has(a.hash))
        const merged = [...existing, ...newAssets]
        saveIndex(merged)

        console.log(`✅ 索引完成!`)
        console.log(`   新增: ${newAssets.length} 个资产`)
        console.log(`   跳过: ${assets.length - newAssets.length} 个 (已存在)`)
        console.log(`   总计: ${merged.length} 个资产`)
      }

      if (githubRepo) {
        console.log(`🌐 索引 GitHub 仓库: ${githubRepo}...\n`)
        const assets = await indexGitHubRepo(githubRepo)

        // Merge
        const existing = loadIndex()
        const existingHashes = new Set(existing.map(a => a.hash))
        const newAssets = assets.filter(a => !existingHashes.has(a.hash))
        const merged = [...existing, ...newAssets]
        saveIndex(merged)

        console.log(`\n✅ 索引完成!`)
        console.log(`   新增: ${newAssets.length} 个资产`)
        console.log(`   总计: ${merged.length} 个资产`)
      }
      break
    }

    case 'tombstone': {
      if (flags['create']) {
        const assetPath = flags['create']
        const cause = flags['cause'] || '寿终正寝'
        const epitaph = flags['epitaph']
        const tagsStr = flags['tags']
        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined

        console.log(`🪦 为 ${assetPath} 创建墓碑...\n`)
        const tombstone = createTombstone({
          path: assetPath,
          cause,
          epitaph,
          tags,
        })

        console.log(formatTombstone(tombstone))
        console.log(`✅ 墓碑已创建: ${tombstone.id}`)
      } else if (subcommand === 'list' || flags['list'] === 'true') {
        const tombstones = listTombstones()
        if (tombstones.length === 0) {
          console.log('🏛️ 墓地空空如也')
        } else {
          console.log(`\n🪦 墓碑列表 (${tombstones.length}):\n`)
          for (const t of tombstones) {
            const status = t.resurrectedAt ? '🧟' : '💀'
            console.log(`  ${status} ${t.id} | ${t.name} | ${t.causeOfDeath}`)
            console.log(`     🏷️ ${t.tags.map(tag => `#${tag}`).join(' ')}`)
          }
        }
      } else if (subcommand === 'stats' || flags['stats'] === 'true') {
        const stats = getRegistryStats()
        console.log(`\n🪦 墓碑统计`)
        console.log('═'.repeat(50))
        console.log(`   总墓碑: ${stats.total}`)
        console.log(`   已复活: ${stats.alive}`)
        console.log(`   仍死亡: ${stats.dead}`)
        if (Object.keys(stats.byLanguage).length > 0) {
          console.log(`\n   按语言:`)
          for (const [k, v] of Object.entries(stats.byLanguage)) {
            console.log(`     ${k}: ${v}`)
          }
        }
      } else {
        console.log(`
🪦 cemetery tombstone - 墓碑管理

用法:
  cemetery tombstone --create <path> --cause <reason>    创建墓碑
  cemetery tombstone --create <path> --cause <reason> --epitaph <text> --tags <t1,t2>
  cemetery tombstone list                                列出所有墓碑
  cemetery tombstone stats                               墓碑统计

示例:
  cemetery tombstone --create ./src/old-auth.ts --cause "被新认证模块替代"
  cemetery tombstone --create ./lib/utils.ts --cause "deprecated" --tags "auth,legacy"
  cemetery tombstone list
  cemetery tombstone stats
        `)
      }
      break
    }

    case 'search': {
      const query = [...positional, ...Object.entries(flags).filter(([k]) => k !== 'limit').map(([, v]) => v)].join(' ')
        || args.slice(1).filter(a => !a.startsWith('--')).join(' ')

      if (!query) {
        console.log(`
🔍 cemetery search - 搜索所有资产和墓碑

用法:
  cemetery search <query>

示例:
  cemetery search auth
  cemetery search "typescript utils"
  cemetery search logger
        `)
        return
      }

      console.log(`🔍 搜索: "${query}"\n`)

      // Search assets
      const assetResults = searchAssets({ query, limit: 10 })
      // Search tombstones
      const tombstoneResults = searchTombstones(query)

      if (assetResults.length === 0 && tombstoneResults.length === 0) {
        console.log('😢 没有找到匹配的结果')
        return
      }

      if (assetResults.length > 0) {
        console.log(`📦 资产匹配 (${assetResults.length}):\n`)
        for (const a of assetResults) {
          const status = a.alive ? '🟢' : '💀'
          console.log(`  ${status} ${a.name} [${a.type}] ${a.language || ''}`)
          console.log(`     📍 ${a.location}`)
          console.log(`     📝 ${a.summary}`)
          console.log(`     🏷️ ${a.tags.map(t => `#${t}`).join(' ')}`)
          console.log('')
        }
      }

      if (tombstoneResults.length > 0) {
        console.log(`🪦 墓碑匹配 (${tombstoneResults.length}):\n`)
        for (const t of tombstoneResults) {
          const status = t.resurrectedAt ? '🧟' : '💀'
          console.log(`  ${status} ${t.name} [${t.id}]`)
          console.log(`     💀 ${t.causeOfDeath}`)
          console.log(`     📜 "${t.epitaph}"`)
          console.log(`     🏷️ ${t.tags.map(tag => `#${tag}`).join(' ')}`)
          console.log('')
        }
      }
      break
    }

    case 'assets': {
      const type = flags['type']

      if (type) {
        const assets = listByType(type)
        if (assets.length === 0) {
          console.log(`📦 没有找到类型为 "${type}" 的资产`)
        } else {
          console.log(`\n📦 ${type} 类型资产 (${assets.length}):\n`)
          for (const a of assets) {
            const status = a.alive ? '🟢' : '💀'
            console.log(`  ${status} ${a.name} ${a.language ? `[${a.language}]` : ''}`)
            console.log(`     📍 ${a.location}`)
            console.log(`     📝 ${a.summary}`)
            console.log('')
          }
        }
      } else if (subcommand === 'stats' || flags['stats'] === 'true') {
        const stats = getAssetStats()
        console.log(`\n📦 资产统计`)
        console.log('═'.repeat(50))
        console.log(`   总资产: ${stats.totalAssets}`)
        console.log(`   存活: ${stats.aliveAssets}`)
        console.log(`   已死亡: ${stats.deadAssets}`)
        console.log(`   总大小: ${(stats.totalSize / 1024).toFixed(1)} KB`)
        console.log(`   总行数: ${stats.totalLines.toLocaleString()}`)
        if (Object.keys(stats.byType).length > 0) {
          console.log(`\n   按类型:`)
          for (const [k, v] of Object.entries(stats.byType)) {
            console.log(`     ${k}: ${v}`)
          }
        }
        if (Object.keys(stats.byLanguage).length > 0) {
          console.log(`\n   按语言:`)
          for (const [k, v] of Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1])) {
            console.log(`     ${k}: ${v}`)
          }
        }
      } else {
        console.log(`
📦 cemetery assets - 资产管理

用法:
  cemetery assets --type <type>      列出指定类型的资产
  cemetery assets stats              资产统计

类型:
  code, text, config, template, idea, snippet, document

示例:
  cemetery assets --type code
  cemetery assets --type config
  cemetery assets stats
        `)
      }
      break
    }

    // ========== Legacy Commands ==========

    case '--visit': {
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
    }

    case '--stats': {
      const stats = cemeteryStats()
      console.log(`\n📊 墓地统计`)
      console.log('─'.repeat(50))
      console.log(`   总墓碑数: ${stats.total}`)
      console.log(`   平均寿命: ${stats.avgAgeDays} 天`)
      console.log(`   凶手数量: ${stats.uniqueKillers} 人`)
      console.log(`   最老墓碑: ${stats.oldest.name} (${stats.oldest.age})`)
      console.log(`   最新墓碑: ${stats.newest.name} (${stats.newest.dateOfDeath})\n`)
      break
    }

    case '--anniversary': {
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
    }

    case '--resurrect': {
      const id = args[1]
      if (canResurrect(id)) {
        console.log(`\n🎉 诈尸啦！${id} 可能要复活了！`)
      } else {
        console.log(`\n💀 安息吧，这个墓碑不会再醒了`)
      }
      break
    }

    case '--egg': {
      const code = args[1]
      const egg = easterEgg(code)
      if (egg) {
        console.log(`\n🎁 彩蛋触发！${egg}`)
      } else {
        console.log(`\n🤷 这个彩蛋还没被发现过`)
      }
      break
    }

    case '--scan': {
      console.log('\n🕵️ 开始扫描墓地...\n')
      try {
        const scanner = new CodeCorpseScanner()
        await scanner.scanAll()
      } catch (error) {
        console.log('⚠️ Scanner 初始化失败:', error)
        console.log('💡 请先配置 cemetery.config.json')
      }
      break
    }

    case '--detect': {
      const detectArgs = args.slice(1)
      if (detectArgs.length === 0) {
        console.log('\n🧟 诈尸检测')
        console.log('─'.repeat(50))
        console.log('用法: cemetery --detect <repo-name>')
      } else {
        try {
          const detector = new ZombieDetector()
          await detector.detect(detectArgs[0])
        } catch (error) {
          console.log('⚠️ 检测失败:', error)
        }
      }
      break
    }

    case '--init': {
      console.log(`
🪦 Code Corpses 初始化

请复制配置模板:
  cp cemetery.config.example.yaml cemetery.config.yaml
  cp mortuary.config.example.yaml mortuary.config.yaml

然后编辑配置文件并运行:
  cemetery index --path ./src
  cemetery --scan
      `)
      break
    }

    case '--help':
    default: {
      console.log(`
🪦 Code Corpses - 代码尸体集中营
   De-location Storage | Tombstone as Epitaph | Abstract Asset Layer

用法: cemetery <命令> [选项]

📦 资产索引 (NEW):
  index --path <path>                       索引本地目录
  index --github <repo>                     索引 GitHub 仓库
  search <query>                            搜索所有资产和墓碑
  assets --type <type>                      按类型列出资产
  assets stats                              资产统计

🪦 墓碑管理 (NEW):
  tombstone --create <path> --cause <reason>  创建墓碑
  tombstone list                              列出所有墓碑
  tombstone stats                             墓碑统计

🎮 经典命令:
  --visit                  🎲 随机访问一个墓碑
  --stats                  📊 查看墓地统计数据
  --anniversary            🎂 查看今日忌日
  --resurrect <id>         🔄 检测墓碑能否复活
  --egg <code>             🎁 触发彩蛋

🤖 AI 自动化:
  --init                   ⚙️ 初始化配置
  --scan                   🕵️ 扫描 GitHub 找死代码
  --detect <repo>          🧟 检测诈尸

💡 示例:
  cemetery index --path ./my-project/src
  cemetery index --github owner/repo
  cemetery tombstone --create ./old-code.ts --cause "deprecated"
  cemetery search "auth utils"
  cemetery assets --type code
  cemetery --visit

📖 文档: https://github.com/Zhifeng-Niu/programmer-corpses
      `)
    }
  }
}

main().catch(console.error)
