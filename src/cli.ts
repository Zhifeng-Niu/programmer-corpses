#!/usr/bin/env node

/**
 * 🪦 Code Corpses CLI - 代码墓地命令行工具
 * 
 * Human Off the Loop: AI works autonomously, humans only see results
 */

import * as fs from 'fs'
import * as path from 'path'

// Core modules
import { CodeAnalyzer } from './core/analyzer.js'
import { DashboardGenerator } from './dashboard.js'
import {
  loadIndex,
  indexDirectory,
  searchAssets,
  getStats,
  AssetType
} from './asset-index.js'
import {
  createTombstone,
  searchTombstones,
  listTombstones,
  formatTombstone,
  getRegistryStats,
  Tombstone
} from './tombstone-registry.js'

// ========== CLI Parser ==========

interface CLIConfig {
  command: string
  subcommand?: string
  flags: Record<string, string | boolean>
  positional: string[]
}

function parseArgs(args: string[]): CLIConfig {
  const flags: Record<string, any> = {}
  const positional: string[] = []
  let command = args[0] || 'dashboard'
  let subcommand: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '')
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        flags[key] = nextArg
        i++
      } else {
        flags[key] = true
      }
    } else if (i > 0 && !arg.startsWith('-')) {
      positional.push(arg)
    }
  }

  // Detect serve mode
  if (command === 'serve') {
    if (positional[0] === 'mcp') subcommand = 'mcp'
    else if (positional[0] === 'api') subcommand = 'api'
    else if (positional[0] === 'openai') subcommand = 'openai'
  }

  return { command, subcommand, flags, positional }
}

// ========== Helper Functions ==========

function getFlag(flags: Record<string, any>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = flags[key]
    if (value && typeof value === 'string') {
      return value
    }
  }
  return undefined
}

async function serveMode(mode: string, flags: Record<string, any>) {
  const port = parseInt(getFlag(flags, 'port') || '3000') || (mode === 'api' ? 3000 : 3001)

  switch (mode) {
    case 'mcp': {
      console.log(`\n🤖 启动 MCP Server (端口 ${port})...`)
      console.log('   使用方式: 在 Claude Code 配置中添加 MCP Server')
      console.log('   npx ts-node src/adapters/mcp-server.ts')
      break
    }

    case 'api': {
      console.log(`\n🌐 启动 REST API (端口 ${port})...`)
      console.log('   使用方式: npx ts-node src/adapters/rest-api.ts')
      break
    }

    case 'openai': {
      console.log(`\n🎯 OpenAI Functions 模式`)
      console.log('   使用方式: 导入 src/adapters/openai-functions.ts')
      break
    }

    default:
      console.log(`未知模式: ${mode}`)
  }
}

async function runScan() {
  console.log('\n🕵️ 执行扫描...')
  const assets = indexDirectory(process.cwd())
  console.log(`✅ 扫描完成，发现 ${assets.length} 个资产`)
}

function showStatus() {
  const stats = getStats()
  const tombstoneStats = getRegistryStats()
  
  console.log('\n📊 Cemetery Status:')
  console.log(`   📦 Assets: ${stats.totalAssets} (alive: ${stats.aliveAssets}, dead: ${stats.deadAssets})`)
  console.log(`   🪦 Tombstones: ${tombstoneStats.total} (resurrected: ${tombstoneStats.alive}, dead: ${tombstoneStats.dead})`)
  console.log(`   🧟 Zombies: ${tombstoneStats.total - tombstoneStats.alive}`)
}

function showQuickStatus() {
  console.log(`
🪦 Code Corpses - 代码墓地

使用 cemetery --help 查看所有命令

快速开始:
  cemetery dashboard          📊 生成仪表板
  cemetery index --path .     📂 索引当前目录
  cemetery stats              📊 查看统计
  cemetery serve api          🌐 启动 REST API
  cemetery serve mcp          🤖 启动 MCP Server
      `)
}

function showHelp() {
  console.log(`
🪦 Code Corpses - 代码墓地 CLI

🤖 AI 服务模式:
  cemetery serve api [--port=3000]   🌐 启动 REST API
  cemetery serve mcp [--port=3001]   🤖 启动 MCP Server
  cemetery serve openai              🎯 OpenAI 函数模式

📊 仪表板:
  cemetery dashboard                 📊 生成 Markdown 仪表板
  cemetery digest                    📱 生成摘要（用于通知）

🕵️ 扫描与分析:
  cemetery scan now                  🕵️ 立即执行扫描
  cemetery analyze <path>            🔍 分析代码是否已死
  cemetery index --path <path>       📂 索引目录

📦 资产管理:
  cemetery assets                    📊 资产统计
  cemetery search <query>            🔍 搜索资产

🪦 墓碑管理:
  cemetery tombstone --create <path> --cause <reason>  🪦 创建墓碑
  cemetery tombstone list                             列出墓碑
  cemetery tombstone random                           随机访问墓碑

📖 文档: https://github.com/Zhifeng-Niu/programmer-corpses
      `)
}

// ========== Main Entry ==========

const args = process.argv.slice(2)
const parsed = parseArgs(args)
const { command, subcommand, flags, positional } = parsed

async function main() {
  // Serve mode - start a server
  if (command === 'serve') {
    await serveMode(subcommand || 'api', flags)
    return
  }

  // Default: show quick status
  if (args.length === 0) {
    showQuickStatus()
    return
  }

  switch (command) {
    case 'dashboard':
    case 'dash': {
      const output = getFlag(flags, 'output', 'o') || './DASHBOARD.md'
      const format = getFlag(flags, 'format', 'f') || 'markdown'
      
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
      const generator = new DashboardGenerator()
      const digest = generator.generateDigest()
      console.log('\n📊 Cellar Digest:')
      console.log(JSON.stringify(digest, null, 2))
      break
    }

    case 'scan': {
      if (subcommand === 'now' || flags['now'] || positional[0] === 'now') {
        console.log('\n🕵️ Triggering manual scan...')
        await runScan()
      } else {
        console.log(`\n🕵️ Scan Commands\n\n用法:\n  cemetery scan now      立即执行扫描\n  cemetery scan status   查看扫描状态\n        `)
      }
      break
    }

    case 'status': {
      showStatus()
      break
    }

    case 'analyze': {
      const targetPath = positional[0] || getFlag(flags, 'path')
      if (!targetPath) {
        console.log('用法: cemetery analyze <path>')
        return
      }
      
      console.log(`\n🔍 分析 ${targetPath}...`)
      const analyzer = new CodeAnalyzer()
      const result = await analyzer.analyzeCode(targetPath)
      
      console.log(`\n状态: ${result.isDead ? '💀 死亡' : '🟢 存活'}`)
      console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`)
      
      if (result.reasons.length > 0) {
        console.log(`\n死因:`)
        result.reasons.forEach(r => console.log(`  - ${r}`))
      }
      
      if (result.suggestions.length > 0) {
        console.log(`\n建议:`)
        result.suggestions.forEach(s => console.log(`  - ${s}`))
      }
      break
    }

    case 'tombstone':
    case 'tomb': {
      if (positional[0] === 'create' || flags['create']) {
        const assetPath = getFlag(flags, 'create') || positional[1]
        const cause = getFlag(flags, 'cause') || positional[2] || '寿终正寝'
        const epitaph = getFlag(flags, 'epitaph')
        const tagsStr = getFlag(flags, 'tags')
        const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()) : undefined

        if (!assetPath) {
          console.log('用法: cemetery tombstone --create <path> --cause <reason>')
          return
        }

        console.log(`🪦 为 ${assetPath} 创建墓碑...`)
        const tombstone = createTombstone({ path: assetPath, cause, epitaph, tags })
        console.log(formatTombstone(tombstone))
      } else if (positional[0] === 'list' || positional[0] === 'ls') {
        const tombstones = listTombstones()
        console.log(`\n🪦 墓碑列表 (${tombstones.length}):\n`)
        for (const t of tombstones) {
          const status = t.resurrectedAt ? '🧟' : '💀'
          console.log(`  ${status} ${t.name} | ${t.causeOfDeath}`)
        }
      } else if (positional[0] === 'random' || positional[0] === 'visit') {
        const tombstones = listTombstones()
        if (tombstones.length === 0) {
          console.log('🏛️ 墓地为空')
        } else {
          const random = tombstones[Math.floor(Math.random() * tombstones.length)]
          console.log(formatTombstone(random))
        }
      } else {
        console.log(`\n🪦 Tombstone Commands\n\n用法:\n  cemetery tombstone --create <path> --cause <reason>  创建墓碑\n  cemetery tombstone list                             列出墓碑\n  cemetery tombstone random                           随机访问\n        `)
      }
      break
    }

    case 'search':
    case 'find': {
      const query = positional[0] || getFlag(flags, 'query')
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

    case 'index': {
      const targetPath = getFlag(flags, 'path') || positional[0]

      if (!targetPath) {
        console.log(`\n📦 Asset Index\n\n用法:\n  cemetery index --path <path>       索引本地目录\n        `)
        return
      }

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

      const indexPath = path.join(process.cwd(), '.cemetery/asset-index.json')
      const dir = path.dirname(indexPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(indexPath, JSON.stringify(merged, null, 2))

      console.log(`✅ 完成! 新增: ${newAssets.length}, 总计: ${merged.length}`)
      break
    }

    case 'assets': {
      const stats = getStats()
      console.log(`\n📦 资产统计`)
      console.log(`   总资产: ${stats.totalAssets}`)
      console.log(`   存活: ${stats.aliveAssets}`)
      console.log(`   死亡: ${stats.deadAssets}`)
      break
    }

    case 'stats': {
      const stats = getStats()
      const tombstoneStats = getRegistryStats()
      console.log(`\n📊 墓地统计`)
      console.log(`   📦 资产: ${stats.totalAssets} (存活: ${stats.aliveAssets}, 死亡: ${stats.deadAssets})`)
      console.log(`   🪦 墓碑: ${tombstoneStats.total} (复活: ${tombstoneStats.alive}, 仍死亡: ${tombstoneStats.dead})`)
      break
    }

    case 'mcp': {
      console.log('\n🤖 启动 MCP Server...')
      console.log('   使用方式: npx ts-node src/adapters/mcp-server.ts')
      break
    }

    case 'api': {
      console.log('\n🌐 启动 REST API...')
      console.log('   使用方式: npx ts-node src/adapters/rest-api.ts')
      break
    }

    case '--help':
    case '-h':
    case 'help': {
      showHelp()
      break
    }

    default: {
      showQuickStatus()
    }
  }
}

// Run
main().catch(console.error)
