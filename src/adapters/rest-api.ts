/**
 * 🌐 REST API Adapter - REST API 适配器
 * 
 * 让任何支持 HTTP 的 AI agent 都能调用墓地功能
 * 
 * 使用方式:
 *   npx ts-node src/adapters/rest-server.ts
 *   # 或
 *   npm run serve:api
 * 
 * API 端点:
 *   GET  /api/health          - 健康检查
 *   GET  /api/summary         - 获取统计摘要
 *   GET  /api/assets          - 列出资产
 *   GET  /api/tombstones      - 列出墓碑
 *   GET  /api/search          - 搜索
 *   POST /api/analyze         - 分析代码
 *   POST /api/tombstone       - 创建墓碑
 *   POST /api/detect-zombie   - 检测诈尸
 *   POST /api/index           - 索引目录
 */

import express, { Request, Response, NextFunction } from 'express'
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
import { CemeteryCapability, CemeterySummary, AnalysisResult, ZombieResult } from '../core/interfaces.js'

// ========== Capability Implementation ==========

class RESTCemeteryCapability implements CemeteryCapability {
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
      } catch { continue }
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
      if (result.isZombie) matches.push(result)
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
    return { added: trulyNew.length, skipped: newAssets.length - trulyNew.length, total: merged.length }
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
      trends: { newThisWeek: 0, diedThisMonth: 0, resurrectedThisMonth: 0, avgLifespan: 0 },
      topKillers: []
    }
  }
  
  async getDigest(): Promise<CemeterySummary> {
    return this.getSummary()
  }
}

// ========== REST Server ==========

class RESTServer {
  private app: express.Application
  private capability: RESTCemeteryCapability
  private server: any
  private baseUrl: string
  
  constructor(basePath?: string) {
    this.app = express()
    this.capability = new RESTCemeteryCapability(basePath)
    this.baseUrl = ''
    this.setupMiddleware()
    this.setupRoutes()
  }
  
  private setupMiddleware() {
    this.app.use(express.json())
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
        return
      }
      next()
    })
  }
  
  private setupRoutes() {
    // Health check
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'cemetery', timestamp: new Date().toISOString() })
    })
    
    // Summary
    this.app.get('/api/summary', async (req: Request, res: Response) => {
      try {
        const summary = await this.capability.getSummary()
        res.json(summary)
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Assets
    this.app.get('/api/assets', async (req: Request, res: Response) => {
      try {
        const filter = {
          type: req.query.type,
          language: req.query.language,
          alive: req.query.alive === 'true' ? true : req.query.alive === 'false' ? false : undefined,
          limit: parseInt(req.query.limit as string) || 50
        }
        const assets = await this.capability.listAssets(filter)
        res.json({ assets, total: assets.length })
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Tombstones
    this.app.get('/api/tombstones', async (req: Request, res: Response) => {
      try {
        const tombstones = listTombstones()
        res.json({ tombstones, total: tombstones.length })
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Search
    this.app.get('/api/search', async (req: Request, res: Response) => {
      try {
        const query = req.query.q as string
        if (!query) {
          return res.status(400).json({ error: 'Missing query parameter q' })
        }
        const results = await this.capability.search(query, {
          types: req.query.types ? (req.query.types as string).split(',') : undefined,
          limit: parseInt(req.query.limit as string) || 20
        })
        res.json({ results, total: results.length })
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Analyze
    this.app.post('/api/analyze', async (req: Request, res: Response) => {
      try {
        const { path, thresholdDays } = req.body
        if (!path) {
          return res.status(400).json({ error: 'Missing path parameter' })
        }
        const result = await this.capability.analyzeCode(path)
        res.json(result)
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Create tombstone
    this.app.post('/api/tombstone', async (req: Request, res: Response) => {
      try {
        const { path, cause, epitaph, tags, summary } = req.body
        if (!path || !cause) {
          return res.status(400).json({ error: 'Missing path or cause' })
        }
        const tombstone = await this.capability.createTombstone(path, cause, { epitaph, tags, summary })
        res.json({ success: true, tombstone })
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Detect zombie
    this.app.post('/api/detect-zombie', async (req: Request, res: Response) => {
      try {
        const { code, threshold } = req.body
        if (!code) {
          return res.status(400).json({ error: 'Missing code parameter' })
        }
        const result = await this.capability.detectZombie(code, { threshold })
        res.json(result)
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Index path
    this.app.post('/api/index', async (req: Request, res: Response) => {
      try {
        const { path: pathStr } = req.body
        if (!pathStr) {
          return res.status(400).json({ error: 'Missing path parameter' })
        }
        const result = await this.capability.indexPath(pathStr)
        res.json(result)
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // Visit random tombstone
    this.app.get('/api/tombstone/random', async (req: Request, res: Response) => {
      try {
        const tombstones = listTombstones()
        if (tombstones.length === 0) {
          return res.json({ message: '墓地为空' })
        }
        const random = tombstones[Math.floor(Math.random() * tombstones.length)]
        res.json(random)
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    })
    
    // OpenAPI spec
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        openapi: '3.0.0',
        info: { title: 'Cemetery API', version: '1.0.0', description: '代码墓地 - 死代码管理 API' },
        servers: [{ url: this.baseUrl || 'http://localhost:3000' }],
        paths: {
          '/api/health': { get: { summary: '健康检查', responses: { '200': { description: 'OK' } } } },
          '/api/summary': { get: { summary: '获取统计摘要', responses: { '200': { description: 'Summary' } } } },
          '/api/assets': { get: { summary: '列出资产', parameters: [{ name: 'type', in: 'query' }, { name: 'language', in: 'query' }, { name: 'alive', in: 'query' }, { name: 'limit', in: 'query' }] } },
          '/api/tombstones': { get: { summary: '列出墓碑' } },
          '/api/search': { get: { summary: '搜索', parameters: [{ name: 'q', in: 'query', required: true }, { name: 'types', in: 'query' }, { name: 'limit', in: 'query' }] } },
          '/api/analyze': { post: { summary: '分析代码' } },
          '/api/tombstone': { post: { summary: '创建墓碑' } },
          '/api/detect-zombie': { post: { summary: '检测诈尸' } },
          '/api/index': { post: { summary: '索引目录' } },
          '/api/tombstone/random': { get: { summary: '随机墓碑' } }
        }
      })
    })
  }
  
  async start(port: number = 3000, host: string = '0.0.0.0'): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, host, () => {
        this.baseUrl = `http://${host}:${port}`
        console.log(`🌐 Cemetery REST API 已启动: ${this.baseUrl}`)
        console.log(`   API 文档: ${this.baseUrl}/api`)
        resolve()
      })
    })
  }
  
  stop(): void {
    if (this.server) {
      this.server.close()
      console.log('🛑 REST API 已停止')
    }
  }
  
  getBaseUrl(): string {
    return this.baseUrl
  }
}

// ========== CLI Entry ==========

if (require.main === module) {
  const args = process.argv.slice(2)
  const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3000')
  const host = args.find(a => a.startsWith('--host='))?.split('=')[1] || '0.0.0.0'
  
  const server = new RESTServer()
  
  // Handle shutdown
  process.on('SIGINT', () => {
    server.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    server.stop()
    process.exit(0)
  })
  
  server.start(port, host).catch(console.error)
}

export { RESTServer, RESTCemeteryCapability }
