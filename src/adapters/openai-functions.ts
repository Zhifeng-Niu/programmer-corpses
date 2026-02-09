/**
 * 🎯 OpenAI Functions Adapter - OpenAI 函数适配器
 * 
 * 让 GPT-4 和兼容 OpenAI API 的模型能够调用墓地功能
 * 
 * 使用方式:
 * 1. 直接导入使用
 * 2. 或通过 REST API 暴露
 */

import { 
  CemeteryCapability, 
  CemeterySummary, 
  AnalysisResult, 
  ZombieResult,
  AssetFilter,
  SearchResult
} from '../core/interfaces.js'
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
import * as fs from 'fs'
import * as path from 'path'

// ========== OpenAI Function Definitions ==========

export const functionDefinitions = [
  {
    type: 'function',
    function: {
      name: 'cemetery_analyze_code',
      description: '分析代码是否已"死掉"。检测标准包括：超过90天无更新、代码复杂度极高、存在废弃依赖、无实际引用等。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '代码文件或目录路径'
          },
          thresholdDays: {
            type: 'number',
            description: '死代码阈值天数（默认90天）'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cemetery_create_tombstone',
      description: '为一段代码创建墓碑。记录代码的死因、墓志铭、标签等信息，使其成为可搜索的遗产。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要墓碑化的代码路径'
          },
          cause: {
            type: 'string',
            description: '死因，如：需求变更、技术债务、架构重构、依赖废弃、性能问题、安全漏洞、业务下线'
          },
          epitaph: {
            type: 'string',
            description: '墓志铭（可选，将自动生成）'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: '标签数组，如：["auth", "deprecated", "legacy"]'
          },
          summary: {
            type: 'string',
            description: '代码摘要描述'
          }
        },
        required: ['path', 'cause']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cemetery_detect_zombie',
      description: '检测新代码是否为"诈尸"，即从墓地中的死代码复制或修改而来。适用于代码审查、安全审计。',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: '新代码内容'
          },
          threshold: {
            type: 'number',
            description: '相似度阈值，0-1之间，默认0.7'
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cemetery_list_assets',
      description: '列出墓地中的所有代码资产，支持按类型、语言、存活状态等条件筛选。',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['code', 'text', 'config', 'template', 'idea', 'snippet', 'document'],
            description: '按代码类型筛选'
          },
          language: {
            Type: 'string',
            description: '按编程语言筛选，如：TypeScript、Python、Go'
          },
          alive: {
            type: 'boolean',
            description: '是否存活，true表示活跃代码，false表示已死亡代码'
          },
          limit: {
            type: 'number',
            description: '返回数量限制，默认50'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cemetery_search',
      description: '搜索墓地中的资产和墓碑，支持关键词匹配。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词'
          },
          types: {
            type: 'array',
            items: { type: 'string', enum: ['asset', 'tombstone'] },
            description: '搜索类型过滤'
          },
          limit: {
            type: 'number',
            description: '返回数量限制，默认20'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cemetery_get_summary',
      description: '获取墓地统计摘要，包括资产数量、墓碑数量、复活率等关键指标。'
    }
  },
  {
    type: 'function',
    function: {
      name: 'cemetery_index_path',
      description: '索引一个目录，将所有代码添加到墓地资产索引中。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要索引的目录路径'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cemetery_visit_tombstone',
      description: '随机访问一个代码墓碑，获取死代码的故事和墓志铭。用于了解历史代码的有趣方式。'
    }
  }
]

// ========== Implementation ==========

class OpenAICemeteryCapability implements CemeteryCapability {
  private basePath: string
  private analyzer: CodeAnalyzer
  
  constructor(basePath?: string) {
    this.basePath = basePath || process.cwd()
    this.analyzer = new CodeAnalyzer({ basePath: this.basePath })
  }
  
  async analyzeCode(pathStr: string): Promise<AnalysisResult> {
    return this.analyzer.analyzeCode(pathStr)
  }
  
  async analyzeCodeContent(content: string, filePath?: string): Promise<AnalysisResult> {
    return this.analyzer.analyzeCodeContent(content, filePath)
  }
  
  async createTombstone(pathStr: string, cause: string, options?: any): Promise<Tombstone> {
    return createTombstone({ 
      path: pathStr, 
      cause, 
      epitaph: options?.epitaph,
      tags: options?.tags,
      summary: options?.summary
    })
  }
  
  async resurrectTombstone(id: string, newLocation: string): Promise<Tombstone | null> {
    return null
  }
  
  async detectZombie(newCode: string, options?: any): Promise<ZombieResult> {
    const tombstones = listTombstones(this.basePath)
    let bestMatch: ZombieResult = { isZombie: false, similarity: 0, resurrectionType: 'copy-paste', confidence: 0, matchedSegments: [] }
    
    for (const tomb of tombstones.slice(0, 20)) {
      if (!fs.existsSync(tomb.originalPath)) continue
      
      try {
        const content2 = fs.readFileSync(tomb.originalPath, 'utf-8')
        const similarity = this.calculateSimilarity(newCode, content2)
        
        if (similarity > bestMatch.similarity) {
          bestMatch = {
            isZombie: similarity > (options?.threshold || 0.7),
            similarity,
            originalId: tomb.id,
            resurrectionType: similarity > 0.9 ? 'clone' : 'copy-paste',
            confidence: similarity,
            matchedSegments: []
          }
        }
      } catch {
        continue
      }
    }
    
    return bestMatch
  }
  
  private calculateSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean))
    const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean))
    const intersection = [...setA].filter(w => setB.has(w)).length
    const union = new Set([...setA, ...setB]).size
    return union > 0 ? intersection / union : 0
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
  
  async listAssets(filter?: AssetFilter): Promise<AssetMetadata[]> {
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
    
    return { added: trulyNew.length, skipped: newAssets.length - trulyNew.length, total: merged.length }
  }
  
  async search(query: string, options?: any): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    
    if (!options?.types || options.types.includes('asset')) {
      const assetResults = searchAssets({ query, limit: options?.limit || 20 }, this.basePath)
      for (const asset of assetResults) {
        results.push({ type: 'asset', data: asset, score: 1, highlights: [] })
      }
    }
    
    if (!options?.types || options.types.includes('tombstone')) {
      const tombstoneResults = searchTombstones(query, this.basePath)
      for (const tomb of tombstoneResults) {
        results.push({ type: 'tombstone', data: tomb, score: 1, highlights: [] })
      }
    }
    
    return results.slice(0, options?.limit || 20)
  }
  
  async getSummary(): Promise<CemeterySummary> {
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

// ========== Function Handler ==========

export class OpenAIFunctionsHandler {
  private capability: OpenAICemeteryCapability
  
  constructor(basePath?: string) {
    this.capability = new OpenAICemeteryCapability(basePath)
  }
  
  getFunctionDefinitions() {
    return functionDefinitions
  }
  
  async callFunction(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'cemetery_analyze_code': {
        const result = await this.capability.analyzeCode(args.path)
        return {
          isDead: result.isDead,
          confidence: result.confidence,
          reasons: result.reasons,
          suggestions: result.suggestions,
          metrics: result.metrics
        }
      }
      
      case 'cemetery_create_tombstone': {
        const tombstone = await this.capability.createTombstone(args.path, args.cause, {
          epitaph: args.epitaph,
          tags: args.tags,
          summary: args.summary
        })
        return {
          success: true,
          tombstone: {
            id: tombstone.id,
            name: tombstone.name,
            causeOfDeath: tombstone.causeOfDeath,
            epitaph: tombstone.epitaph,
            diedAt: tombstone.diedAt
          }
        }
      }
      
      case 'cemetery_detect_zombie': {
        const result = await this.capability.detectZombie(args.code, { threshold: args.threshold })
        return {
          isZombie: result.isZombie,
          similarity: result.similarity,
          originalId: result.originalId,
          resurrectionType: result.resurrectionType
        }
      }
      
      case 'cemetery_list_assets': {
        const assets = await this.capability.listAssets(args)
        return {
          assets: assets.map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            language: a.language,
            alive: a.alive,
            tags: a.tags
          })),
          total: assets.length
        }
      }
      
      case 'cemetery_search': {
        const results = await this.capability.search(args.query, args)
        return {
          results: results.map(r => ({
            type: r.type,
            name: r.type === 'asset' ? (r.data as AssetMetadata).name : (r.data as Tombstone).name,
            score: r.score
          })),
          total: results.length
        }
      }
      
      case 'cemetery_get_summary': {
        const summary = await this.capability.getSummary()
        return summary
      }
      
      case 'cemetery_index_path': {
        const result = await this.capability.indexPath(args.path)
        return result
      }
      
      case 'cemetery_visit_tombstone': {
        const tombstones = listTombstones()
        if (tombstones.length === 0) {
          return { message: '墓地为空，暂无墓碑' }
        }
        const random = tombstones[Math.floor(Math.random() * tombstones.length)]
        return {
          name: random.name,
          causeOfDeath: random.causeOfDeath,
          epitaph: random.epitaph,
          diedAt: random.diedAt
        }
      }
      
      default:
        throw new Error(`Unknown function: ${name}`)
    }
  }
}

// ========== CLI Entry ==========

if (require.main === module) {
  const args = process.argv.slice(2)
  
  console.log(`
🎯 OpenAI Functions Adapter - OpenAI 函数适配器

可用函数:
  - cemetery_analyze_code    分析代码是否已死
  - cemetery_create_tombstone  创建墓碑
  - cemetery_detect_zombie   检测诈尸
  - cemetery_list_assets     列出资产
  - cemetery_search          搜索
  - cemetery_get_summary     获取统计
  - cemetery_index_path      索引目录
  - cemetery_visit_tombstone 随机访问墓碑

使用方法:
  1. 在 OpenAI GPTs 或自定义 GPT 中配置函数定义
  2. 将此模块作为工具后端
  3. 或通过 REST API 暴露 (见 rest-server.ts)
  `)
}
