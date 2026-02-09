/**
 * 🤖 MCP Server Adapter - MCP 服务器适配器
 * 
 * 让 Claude Code 和其他 MCP 客户端能够调用墓地功能
 * 
 * 使用方式:
 * 1. npx ts-node src/adapters/mcp-server.ts
 * 2. 或通过 stdio 模式运行
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool 
} from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'fs'
import * as path from 'path'

// Import core modules
import { CodeAnalyzer } from '../core/analyzer.js'
import { 
  loadIndex, 
  searchAssets, 
  getStats, 
  indexDirectory,
  AssetMetadata,
  AssetType 
} from '../asset-index.js'
import { 
  createTombstone, 
  listTombstones, 
  searchTombstones, 
  getRegistryStats,
  Tombstone 
} from '../tombstone-registry.js'
import { DashboardGenerator } from '../dashboard.js'
import { CemeteryCapability, CemeterySummary, AnalysisResult, ZombieResult } from '../core/interfaces.js'

// ========== Cemetery Capability Implementation ==========

class MCPCemeteryCapability implements CemeteryCapability {
  private basePath: string
  private analyzer: CodeAnalyzer
  
  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd()
    this.analyzer = new CodeAnalyzer({ basePath: this.basePath })
  }
  
  async analyzeCode(path: string): Promise<AnalysisResult> {
    return this.analyzer.analyzeCode(path)
  }
  
  async analyzeCodeContent(content: string, filePath?: string): Promise<AnalysisResult> {
    return this.analyzer.analyzeCodeContent(content, filePath)
  }
  
  async createTombstone(path: string, cause: string, options?: any): Promise<Tombstone> {
    return createTombstone({ 
      path, 
      cause, 
      epitaph: options?.epitaph,
      tags: options?.tags,
      summary: options?.summary
    })
  }
  
  async resurrectTombstone(id: string, newLocation: string): Promise<Tombstone | null> {
    // Implementation would go here
    return null
  }
  
  async detectZombie(newCode: string, options?: any): Promise<ZombieResult> {
    // Simple zombie detection based on string similarity
    const tombstones = listTombstones(this.basePath)
    let bestMatch: ZombieResult = { isZombie: false, similarity: 0, resurrectionType: 'copy-paste', confidence: 0, matchedSegments: [] }
    
    for (const tomb of tombstones.slice(0, 20)) {
      // Very basic similarity check - in production use proper diff algorithm
      const similarity = this.calculateSimilarity(newCode, tomb.originalPath)
      if (similarity > bestMatch.similarity) {
        bestMatch = {
          isZombie: similarity > 0.7,
          similarity,
          originalId: tomb.id,
          resurrectionType: 'copy-paste',
          confidence: similarity,
          matchedSegments: []
        }
      }
    }
    
    return bestMatch
  }
  
  private calculateSimilarity(code1: string, path2: string): number {
    // Very basic implementation
    if (!fs.existsSync(path2)) return 0
    try {
      const content2 = fs.readFileSync(path2, 'utf-8')
      const words1 = new Set(code1.split(/\s+/))
      const words2 = new Set(content2.split(/\s+/))
      const intersection = [...words1].filter(w => words2.has(w)).length
      const union = new Set([...words1, ...words2]).size
      return union > 0 ? intersection / union : 0
    } catch {
      return 0
    }
  }
  
  async findZombieMatches(newCode: string, limit?: number): Promise<ZombieResult[]> {
    const tombstones = listTombstones(this.basePath)
    const matches: ZombieResult[] = []
    
    for (const tomb of tombstones.slice(0, limit || 50)) {
      const result = await this.detectZombie(newCode, { threshold: 0.5 })
      if (result.isZombie) {
        matches.push(result)
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, limit || 10)
  }
  
  async listAssets(filter?: any): Promise<AssetMetadata[]> {
    return searchAssets(filter || {}, this.basePath)
  }
  
  async getAsset(idOrPath: string): Promise<AssetMetadata | null> {
    const index = loadIndex(this.basePath)
    return index.find(a => a.id === idOrPath || a.location === idOrPath) || null
  }
  
  async indexPath(pathStr: string): Promise<{ added: number; skipped: number; total: number }> {
    const absolutePath = path.isAbsolute(pathStr) ? pathStr : path.join(this.basePath, pathStr)
    const newAssets = indexDirectory(absolutePath)
    const existing = loadIndex(this.basePath)
    const existingHashes = new Set(existing.map(a => a.hash))
    const trulyNew = newAssets.filter(a => !existingHashes.has(a.hash))
    const merged = [...existing, ...trulyNew]
    fs.writeFileSync(path.join(this.basePath, '.cemetery/asset-index.json'), JSON.stringify(merged, null, 2))
    
    return {
      added: trulyNew.length,
      skipped: newAssets.length - trulyNew.length,
      total: merged.length
    }
  }
  
  async search(query: string, options?: any): Promise<any[]> {
    const results: any[] = []
    
    const assetResults = searchAssets({ query, limit: options?.limit || 20 }, this.basePath)
    for (const asset of assetResults) {
      results.push({ type: 'asset', data: asset, score: 1, highlights: [] })
    }
    
    const tombstoneResults = searchTombstones(query, this.basePath)
    for (const tomb of tombstoneResults) {
      results.push({ type: 'tombstone', data: tomb, score: 1, highlights: [] })
    }
    
    return results.slice(0, options?.limit || 20)
  }
  
  async getSummary(): Promise<CemeterySummary> {
    const generator = new DashboardGenerator()
    const digest = generator.generateDigest() as any
    const stats = getStats(this.basePath)
    const tombstoneStats = getRegistryStats(this.basePath)
    
    return {
      generatedAt: new Date().toISOString(),
      assets: {
        total: stats.totalAssets,
        alive: stats.aliveAssets,
        dead: stats.deadAssets,
        byType: stats.byType,
        byLanguage: stats.byLanguage
      },
      tombstones: {
        total: tombstoneStats.total,
        resurrected: tombstoneStats.alive,
        stillDead: tombstoneStats.dead,
        recentDeaths: tombstoneStats.recentDeaths
      },
      trends: {
        newThisWeek: 0,
        diedThisMonth: 0,
        resurrectedThisMonth: 0,
        avgLifespan: 0
      },
      topKillers: []
    }
  }
  
  async getDigest(): Promise<CemeterySummary> {
    return this.getSummary()
  }
}

// ========== Server Implementation ==========

const cemetery = new MCPCemeteryCapability()

const server = new Server(
  { name: 'cemetery', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// Tool definitions
const tools: Tool[] = [
  {
    name: 'analyze_code',
    description: '🔍 分析代码是否已"死掉"（长时间无修改或存在废弃特征）',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '代码文件或目录路径' },
        thresholdDays: { type: 'number', description: '死代码阈值天数（默认90天）' }
      },
      required: ['path']
    }
  },
  {
    name: 'create_tombstone',
    description: '🪦 为一段代码创建墓碑',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '代码路径' },
        cause: { type: 'string', description: '死因（如：需求变更、技术债务、架构重构）' },
        epitaph: { type: 'string', description: '墓志铭（可选，自动生成）' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
        summary: { type: 'string', description: '代码摘要' }
      },
      required: ['path', 'cause']
    }
  },
  {
    name: 'detect_zombie',
    description: '🧟 检测代码是否为"诈尸"（从死代码中复活的代码）',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '新代码内容' },
        threshold: { type: 'number', description: '相似度阈值（默认0.7）' }
      },
      required: ['code']
    }
  },
  {
    name: 'list_assets',
    description: '📦 列出墓地中的所有资产',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['code', 'text', 'config', 'template', 'idea', 'snippet', 'document'], description: '按类型筛选' },
        language: { type: 'string', description: '按编程语言筛选' },
        alive: { type: 'boolean', description: '是否存活' },
        limit: { type: 'number', description: '返回数量限制（默认50）' }
      }
    }
  },
  {
    name: 'search_cemetery',
    description: '🔍 搜索墓地中的资产和墓碑',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        types: { type: 'array', items: { type: 'string', enum: ['asset', 'tombstone'] }, description: '搜索类型' },
        limit: { type: 'number', description: '返回数量限制（默认20）' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_summary',
    description: '📊 获取墓地统计摘要',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'index_path',
    description: '📂 索引一个目录，添加所有代码到墓地',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '要索引的目录路径' }
      },
      required: ['path']
    }
  },
  {
    name: 'visit_tombstone',
    description: '🎲 随机访问一个代码墓碑，获取死代码的故事',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, () => {
  return { tools }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params as { name: string; arguments: Record<string, any> }

  try {
    switch (name) {
      case 'analyze_code': {
        const result = await cemetery.analyzeCode(args.path)
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'create_tombstone': {
        const tombstone = await cemetery.createTombstone(args.path, args.cause, {
          epitaph: args.epitaph,
          tags: args.tags,
          summary: args.summary
        })
        return {
          content: [{
            type: 'text',
            text: `✅ 墓碑已创建!\n\n` +
              `🪦 ${tombstone.name}\n` +
              `💀 死因: ${tombstone.causeOfDeath}\n` +
              `📜 墓志铭: "${tombstone.epitaph}"\n` +
              `📅 死亡日期: ${tombstone.diedAt.split('T')[0]}\n` +
              `🏷️ 标签: ${tombstone.tags.map(t => '#' + t).join(' ')}`
          }]
        }
      }

      case 'detect_zombie': {
        const result = await cemetery.detectZombie(args.code, { threshold: args.threshold || 0.7 })
        return {
          content: [{
            type: 'text',
            text: result.isZombie 
              ? `🧟 检测到诈尸!\n\n相似度: ${(result.similarity * 100).toFixed(1)}%\n原始墓碑: ${result.originalId || '未知'}`
              : `✅ 未检测到诈尸（相似度: ${(result.similarity * 100).toFixed(1)}%）`
          }]
        }
      }

      case 'list_assets': {
        const assets = await cemetery.listAssets(args)
        const list = assets.map(a => 
          `${a.alive ? '🟢' : '💀'} ${a.name} [${a.type}] - ${a.language || '?'}`
        ).join('\n')
        return {
          content: [{
            type: 'text',
            text: `📦 资产列表 (${assets.length}):\n\n${list || '暂无资产'}`
          }]
        }
      }

      case 'search_cemetery': {
        const results = await cemetery.search(args.query, args)
        const text = results.map(r => {
          if (r.type === 'asset') {
            const a = r.data as AssetMetadata
            return `📦 ${a.name} [${a.type}]`
          } else {
            const t = r.data as Tombstone
            return `🪦 ${t.name} - ${t.causeOfDeath}`
          }
        }).join('\n')
        return {
          content: [{
            type: 'text',
            text: `🔍 搜索结果 (${results.length}):\n\n${text || '无结果'}`
          }]
        }
      }

      case 'get_summary': {
        const summary = await cemetery.getSummary()
        return {
          content: [{
            type: 'text',
            text: `📊 墓地统计\n\n` +
              `📦 资产: ${summary.assets.total} (存活: ${summary.assets.alive}, 死亡: ${summary.assets.dead})\n` +
              `🪦 墓碑: ${summary.tombstones.total} (复活: ${summary.tombstones.resurrected}, 仍死亡: ${summary.tombstones.stillDead})\n` +
              `生成时间: ${summary.generatedAt}`
          }]
        }
      }

      case 'index_path': {
        const result = await cemetery.indexPath(args.path)
        return {
          content: [{
            type: 'text',
            text: `✅ 索引完成!\n\n` +
              `新增: ${result.added}\n` +
              `跳过: ${result.skipped}\n` +
              `总计: ${result.total}`
          }]
        }
      }

      case 'visit_tombstone': {
        const tombstones = listTombstones()
        if (tombstones.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `🏛️ 墓地空空如也，还没有代码死掉`
            }]
          }
        }
        const random = tombstones[Math.floor(Math.random() * tombstones.length)]
        return {
          content: [{
            type: 'text',
            text: `🎲 ${random.name}\n\n` +
              `💀 死因: ${random.causeOfDeath}\n` +
              `📜 "${random.epitaph}"\n` +
              `📅 死亡日期: ${random.diedAt.split('T')[0]}`
          }]
        }
      }

      default:
        return {
          content: [{
            type: 'text',
            text: `❌ 未知工具: ${name}`
          }]
        }
    }
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: `❌ 错误: ${error.message || error}`
      }]
    }
  }
})

// ========== Main ==========

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('🪦 Cemetery MCP Server 已启动')
}

main().catch(console.error)
