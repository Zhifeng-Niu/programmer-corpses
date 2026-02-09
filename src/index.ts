#!/usr/bin/env node

/**
 * 🪦 Code Corpses - 代码尸体集中营
 * 
 * Human Off the Loop: AI works autonomously, humans only see results
 * 
 * Simplified CLI:
 * - cemetery dashboard    → Generate/view current state
 * - cemetery scan now    → Trigger manual scan
 * - cemetery start       → Start auto scanner
 * - cemetery stop        → Stop auto scanner
 * - cemetery status      → View current status
 */

import * as fs from 'fs'
import * as path from 'path'

// Auto Scanner
import { AutoScanner } from './auto-scanner'

// Dashboard Generator  
import { DashboardGenerator } from './dashboard'

// Legacy imports (for backward compatibility)
import { CodeCorpseScanner } from './scanner'
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

// ========== CLI Parser ==========

function parseArgs(args: string[]): { command: string; subcommand?: string; flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {}
  const positional: string[] = []
  let command = args[0] || 'dashboard'
  let subcommand: string | undefined

  // Handle subcommands
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
    } else if (i > 0 && !arg.startsWith('-')) {
      if (i > 1 || (i === 1 && !subcommand)) {
        positional.push(arg)
      }
    }
  }

  return { command, subcommand, flags, positional }
}

// ========== Main Entry ==========

const args = process.argv.slice(2)

async function main() {
  const parsed = parseArgs(args)
  const { command, subcommand, flags, positional } = parsed

  // If no arguments, show quick status
  if (args.length === 0) {
    showQuickStatus()
    return
  }

  switch (command) {
    // ========== SIMPLIFIED COMMANDS ==========

    case 'dashboard':
    case 'dash': {
      // Generate dashboard
      const output = flags['output'] || flags['o'] || './DASHBOARD.md'
      const format = flags['format'] || flags['f'] || 'markdown'
      
      console.log('\n📊 Generating dashboard...')
      const generator = new DashboardGenerator({
        outputPath: output,
        outputFormat: format as 'markdown' | 'json' | 'both'
      })
      
      const dashboard = generator.generate()
      console.log('\n' + dashboard)
      break
    }

    case 'digest': {
      // Quick digest for notifications
      const generator = new DashboardGenerator()
      const digest = generator.generateDigest()
      console.log('\n📊 Cellar Digest:')
      console.log(JSON.stringify(digest, null, 2))
      break
    }

    case 'scan': {
      // Manual scan
      if (subcommand === 'now' || flags['now']) {
        console.log('\n🕵️ Triggering manual scan...')
        const scanner = new AutoScanner()
        const report = await scanner.scanNow()
        console.log(report)
      } else {
        console.log(`
🕵️ Scan Commands

用法:
  cemetery scan now      立即执行扫描
  cemetery scan status  查看扫描状态

示例:
  cemetery scan now
        `)
      }
      break
    }

    case 'start': {
      // Start auto scanner
      console.log('\n🚀 Starting auto scanner...')
      const scanner = new AutoScanner()
      scanner.start()
      console.log('✅ Auto scanner started in background')
      console.log('   Press Ctrl+C to stop')
      
      // Keep running
      process.on('SIGINT', () => {
        scanner.stop()
        process.exit(0)
      })
      
      // Block forever
      await new Promise(() => {})
      break
    }

    case 'stop': {
      // Stop auto scanner
      console.log('\n🛑 Stopping auto scanner...')
      const scanner = new AutoScanner()
      scanner.stop()
      console.log('✅ Auto scanner stopped')
      break
    }

    case 'status': {
      // Show current status
      const scanner = new AutoScanner()
      const status = scanner.status()
      console.log('\n📊 Cemetery Status:')
      console.log(JSON.stringify(status, null, 2))
      break
    }

    // ========== DETAILED COMMANDS (Hidden/Subcommand) ==========

    case 'index': {
      const targetPath = flags['path']
      const githubRepo = flags['github']

      if (!targetPath && !githubRepo) {
        console.log(`
📦 Asset Index

用法:
  cemetery index --path <path>       索引本地目录
  cemetery index --github <repo>    索引 GitHub 仓库

示例:
  cemetery index --path ./src
  cemetery index --github owner/repo
        `)
        return
      }

      if (targetPath) {
        const fullPath = path.resolve(targetPath)
        if (!fs.existsSync(fullPath)) {
          console.log(`❌ 路径不存在: ${fullPath}`)
          return
        }
        console.log(`📂 索引 ${fullPath}...`)
        const assets = indexDirectory(fullPath)
        const existing = loadIndex()
        const existingHashes = new Set(existing.map(a => a.hash))
        const newAssets = assets.filter(a => !existingHashes.has(a.hash))
        const merged = [...existing, ...newAssets]
        saveIndex(merged)

        console.log(`✅ 完成! 新增: ${newAssets.length}, 总计: ${merged.length}`)
      }

      if (githubRepo) {
        console.log(`🌐 索引 GitHub: ${githubRepo}...`)
        const assets = await indexGitHubRepo(githubRepo)
        const existing = loadIndex()
        const existingHashes = new Set(existing.map(a => a.hash))
        const newAssets = assets.filter(a => !existingHashes.has(a.hash))
        const merged = [...existing, ...newAssets]
        saveIndex(merged)

        console.log(`✅ 完成! 新增: ${newAssets.length}, 总计: ${merged.length}`)
      }
      break
    }

    case 'tombstone':
    case 'tomb': {
      if (flags['create'] || subcommand === 'create') {
        const assetPath = flags['create'] || positional[0]
        const cause = flags['cause'] || '寿终正寝'
        const epitaph = flags['epitaph']
        const tagsStr = flags['tags']
        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined

        if (!assetPath) {
          console.log('用法: cemetery tombstone --create <path> --cause <reason>')
          return
        }

        console.log(`🪦 为 ${assetPath} 创建墓碑...`)
        const tombstone = createTombstone({ path: assetPath, cause, epitaph, tags })
        console.log(formatTombstone(tombstone))
      } else if (subcommand === 'list' || subcommand === 'ls') {
        const tombstones = listTombstones()
        console.log(`\n🪦 墓碑列表 (${tombstones.length}):\n`)
        for (const t of tombstones) {
          const status = t.resurrectedAt ? '🧟' : '💀'
          console.log(`  ${status} ${t.name} | ${t.causeOfDeath}`)
        }
      } else if (subcommand === 'stats') {
        const stats = getRegistryStats()
        console.log(`\n🪦 墓碑统计: ${stats.total} 总, ${stats.alive} 复活, ${stats.dead} 死亡`)
      } else {
        console.log(`
🪦 Tombstone Commands

用法:
  cemetery tombstone --create <path> --cause <reason>  创建墓碑
  cemetery tombstone list                             列出墓碑
  cemetery tombstone stats                            墓碑统计
        `)
      }
      break
    }

    case 'search':
    case 'find': {
      // For search command, collect all non-flag arguments as query
      const query = args.slice(1).filter(a => !a.startsWith('-')).join(' ')
      
      if (!query) {
        console.log('用法: cemetery search <query>')
        return
      }

      console.log(`🔍 搜索: "${query}"`)
      
      const assetResults = searchAssets({ query, limit: 10 })
      const tombstoneResults = searchTombstones(query)

      if (assetResults.length > 0) {
        console.log(`\n📦 资产 (${assetResults.length}):`)
        for (const a of assetResults) {
          const status = a.alive ? '🟢' : '💀'
          console.log(`  ${status} ${a.name} [${a.type}]`)
        }
      }

      if (tombstoneResults.length > 0) {
        console.log(`\n🪦 墓碑 (${tombstoneResults.length}):`)
        for (const t of tombstoneResults) {
          const status = t.resurrectedAt ? '🧟' : '💀'
          console.log(`  ${status} ${t.name}`)
        }
      }

      if (assetResults.length === 0 && tombstoneResults.length === 0) {
        console.log('😢 没有找到结果')
      }
      break
    }

    case 'assets': {
      if (subcommand === 'stats') {
        const stats = getAssetStats()
        console.log(`\n📦 资产统计`)
        console.log(`   总资产: ${stats.totalAssets}`)
        console.log(`   存活: ${stats.aliveAssets}`)
        console.log(`   死亡: ${stats.deadAssets}`)
      } else {
        const type = positional[0]
        if (type) {
          const assets = listByType(type)
          console.log(`\n📦 ${type} 类型资产 (${assets.length}):`)
          for (const a of assets.slice(0, 10)) {
            const status = a.alive ? '🟢' : '💀'
            console.log(`  ${status} ${a.name}`)
          }
        } else {
          console.log(`
📦 Asset Commands

用法:
  cemetery assets stats           资产统计
  cemetery assets <type>          按类型列出
          `)
        }
      }
      break
    }

    // ========== LEGACY COMMANDS ==========

    case '--visit': {
      const cemetery: Array<{name: string; cause: string; age: string; epitaph: string; emoji: string}> = [
        { name: 'RegEx 验证码解析器', cause: '被产品改成了滑块验证', age: '2周', epitaph: '它曾经能识别99%的验证码，直到验证码学会了自我进化', emoji: '🎭' },
        { name: '微服务X部署脚本', cause: '整个服务被废弃了', age: '3个月', epitaph: '写了200行Bash脚本，就为了省下5分钟的docker compose up', emoji: '🐳' },
        { name: 'Vue 2.0 管理系统', cause: 'Vue 3发布了', age: '8个月', epitaph: 'RIP Composition API，Options API永不为奴！', emoji: '📰' },
      ]
      const tomb = cemetery[Math.floor(Math.random() * cemetery.length)]
      console.log(`\n${tomb.emoji} ${tomb.name}`)
      console.log(`   💀 ${tomb.cause}`)
      console.log(`   ⏰ ${tomb.age}`)
      console.log(`   📜 "${tomb.epitaph}"\n`)
      break
    }

    case '--stats': {
      const stats = getAssetStats()
      console.log(`\n📊 墓地统计`)
      console.log(`   总资产: ${stats.totalAssets}`)
      console.log(`   存活: ${stats.aliveAssets}`)
      console.log(`   死亡: ${stats.deadAssets}`)
      break
    }

    case '--scan': {
      console.log('\n🕵️ 执行完整扫描...')
      try {
        const scanner = new CodeCorpseScanner()
        await scanner.scanAll()
      } catch (error) {
        console.log('⚠️ Scanner 初始化失败:', error)
      }
      break
    }

    case '--help':
    case '-h':
    case 'help': {
      console.log(`
🪦 Code Corpses - 代码尸体集中营
   Human Off the Loop | AI works autonomously

🤖 自动化命令 (推荐):
  cemetery dashboard          📊 生成仪表板
  cemetery dashboard --json    📊 生成 JSON 格式
  cemetery scan now            🕵️ 立即执行扫描
  cemetery start               🚀 启动后台扫描
  cemetery stop                🛑 停止后台扫描
  cemetery status              📊 查看扫描状态
  cemetery digest              📱 生成摘要（用于通知）

📦 资产管理:
  index --path <path>          索引本地目录
  index --github <repo>        索引 GitHub 仓库
  search <query>               搜索资产和墓碑
  assets stats                 资产统计

🪦 墓碑管理:
  tombstone --create <path>    创建墓碑
  tombstone list               列出墓碑

🎮 经典命令:
  --visit                      🎲 随机访问墓碑
  --stats                      📊 统计数据

📖 文档: https://github.com/Zhifeng-Niu/programmer-corpses
      `)
      break
    }

    default: {
      showQuickStatus()
    }
  }
}

function showQuickStatus() {
  console.log(`
🪦 Code Corpses - 代码墓地

使用 cemetery --help 查看所有命令

快速开始:
  cemetery dashboard          📊 生成仪表板
  cemetery scan now           🕵️ 执行扫描
  cemetery start              🚀 启动自动扫描
      `)
}

// Run
main().catch(console.error)
