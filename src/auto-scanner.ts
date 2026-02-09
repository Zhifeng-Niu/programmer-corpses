/**
 * 🪦 Auto Scanner Background Service
 * 
 * Human Off the Loop: AI works autonomously, humans only see results
 * 
 * Features:
 * - Watch configured paths (local + GitHub) automatically
 * - Auto-index new assets on discovery
 * - Auto-detect dead/abandoned assets (no activity for N days)
 * - Auto-generate tombstones for dead assets
 * - Configurable scan intervals per source
 */

import * as fs from 'fs'
import * as path from 'path'
import * as child_process from 'child_process'
import { 
  AssetMetadata, 
  loadIndex, 
  saveIndex, 
  indexDirectory, 
  indexGitHubRepo,
  getStats,
  AssetType,
  AssetSource
} from './asset-index'
import { 
  createTombstone, 
  listTombstones, 
  formatTombstone,
  getRegistryStats,
  Tombstone 
} from './tombstone-registry'

// ========== Configuration ==========

export interface AutoScanConfig {
  enabled: boolean
  interval: number           // Scan interval in seconds (default: 86400 = 24h)
  paths: WatchPath[]        // Paths to watch
  github: GitHubWatch[]     // GitHub repos to watch
  deadThresholdDays: number // Days of inactivity before marking as dead
  autoTombstone: boolean    // Auto-create tombstones for dead assets
  notifications: NotificationConfig
}

export interface WatchPath {
  path: string
  name?: string
  interval?: number         // Override global interval
  autoIndex?: boolean       // Auto-index new files
  extensions?: string[]     // File extensions to watch
}

export interface GitHubWatch {
  repo: string              // owner/repo format
  name?: string
  interval?: number
  autoIndex?: boolean
  branch?: string
}

export interface NotificationConfig {
  channel: 'telegram' | 'discord' | 'slack' | 'none'
  digest: boolean           // Only send digest when interesting
  quietMode: boolean        // No "scan completed" messages
}

// ========== State Management ==========

interface ScanState {
  lastScan: string
  lastScanPath?: string
  discoveredAssets: number
  deadAssets: number
  newTombstones: number
  errors: string[]
}

const STATE_FILE = '.cemetery/scan-state.json'

function loadState(): ScanState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
  }
  return {
    lastScan: new Date().toISOString(),
    discoveredAssets: 0,
    deadAssets: 0,
    newTombstones: 0,
    errors: []
  }
}

function saveState(state: ScanState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// ========== Auto Scanner ==========

export class AutoScanner {
  private config: AutoScanConfig
  private state: ScanState
  private running: boolean = false
  private timer: NodeJS.Timeout | null = null
  private octokit: any = null

  constructor(configPath: string = './cemetery.config.json') {
    this.config = this.loadConfig(configPath)
    this.state = loadState()
    this.initOctokit()
  }

  private loadConfig(configPath: string): AutoScanConfig {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8')
        const raw = configPath.endsWith('.yaml') 
          ? require('js-yaml').load(content)
          : JSON.parse(content)
        
        return {
          enabled: raw.autoScan?.enabled ?? false,
          interval: raw.autoScan?.interval ?? 86400,
          paths: raw.autoScan?.paths ?? [],
          github: raw.autoScan?.github ?? [],
          deadThresholdDays: raw.deadThresholdDays ?? 90,
          autoTombstone: raw.autoTombstone ?? false,
          notifications: {
            channel: raw.notification?.channel ?? 'none',
            digest: raw.notification?.digest ?? true,
            quietMode: raw.notification?.quietMode ?? true
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ 加载配置失败: ${error}`)
    }

    // Default config
    return {
      enabled: false,
      interval: 86400,
      paths: [],
      github: [],
      deadThresholdDays: 90,
      autoTombstone: false,
      notifications: {
        channel: 'none',
        digest: true,
        quietMode: true
      }
    }
  }

  private initOctokit(): void {
    try {
      const { Octokit } = require('@octokit/rest')
      
      // Try to get token from config or env
      let token: string | undefined
      if (fs.existsSync('./cemetery.config.json')) {
        const config = JSON.parse(fs.readFileSync('./cemetery.config.json', 'utf-8'))
        token = config.token
      }
      token = token || process.env.GITHUB_TOKEN

      if (token) {
        this.octokit = new Octokit({ auth: token })
      }
    } catch (error) {
      // Octokit not available
    }
  }

  /**
   * Start background scanning service
   */
  start(): void {
    if (this.running) {
      console.log('⚠️ Auto scanner already running')
      return
    }

    if (!this.config.enabled) {
      console.log('ℹ️ Auto scanner disabled in config')
      return
    }

    this.running = true
    console.log('🪦 Auto scanner started')
    console.log(`   Scan interval: ${this.config.interval}s`)
    console.log(`   Watching ${this.config.paths.length} local paths`)
    console.log(`   Watching ${this.config.github.length} GitHub repos`)
    
    // Run initial scan
    this.scanAll().catch(console.error)

    // Schedule periodic scans
    this.timer = setInterval(() => {
      if (this.running) {
        this.scanAll().catch(console.error)
      }
    }, this.config.interval * 1000)
  }

  /**
   * Stop background scanning
   */
  stop(): void {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    console.log('🪦 Auto scanner stopped')
  }

  /**
   * Get scanner status
   */
  status(): object {
    return {
      running: this.running,
      enabled: this.config.enabled,
      interval: this.config.interval,
      lastScan: this.state.lastScan,
      discoveredAssets: this.state.discoveredAssets,
      deadAssets: this.state.deadAssets,
      newTombstones: this.state.newTombstones,
      watchingPaths: this.config.paths.length,
      watchingGithub: this.config.github.length
    }
  }

  /**
   * Trigger manual scan
   */
  async scanNow(): Promise<string> {
    console.log('🕵️ Manual scan triggered...')
    const report = await this.scanAll()
    return report
  }

  /**
   * Scan all configured sources
   */
  async scanAll(): Promise<string> {
    const startTime = Date.now()
    this.state.errors = []

    console.log('\n🕵️ Starting auto-scan...')
    console.log(`   Time: ${new Date().toISOString()}`)

    // Reset counters for this scan
    let totalNewAssets = 0
    let totalDeadAssets = 0
    let totalNewTombstones = 0

    // Scan local paths
    for (const watchPath of this.config.paths) {
      try {
        const result = await this.scanLocalPath(watchPath)
        totalNewAssets += result.newAssets
        totalDeadAssets += result.deadAssets
        totalNewTombstones += result.newTombstones
      } catch (error: any) {
        this.state.errors.push(`Path ${watchPath.path}: ${error.message}`)
      }
    }

    // Scan GitHub repos
    for (const githubWatch of this.config.github) {
      try {
        const result = await this.scanGitHubRepo(githubWatch)
        totalNewAssets += result.newAssets
        totalDeadAssets += result.deadAssets
        totalNewTombstones += result.newTombstones
      } catch (error: any) {
        this.state.errors.push(`GitHub ${githubWatch.repo}: ${error.message}`)
      }
    }

    // Update state
    this.state.lastScan = new Date().toISOString()
    this.state.discoveredAssets += totalNewAssets
    this.state.deadAssets += totalDeadAssets
    this.state.newTombstones += totalNewTombstones
    saveState(this.state)

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    // Generate report
    const report = this.generateScanReport({
      duration,
      newAssets: totalNewAssets,
      deadAssets: totalDeadAssets,
      newTombstones: totalNewTombstones,
      errors: this.state.errors
    })

    // Send notification if needed
    if (this.shouldNotify({ newAssets: totalNewAssets, deadAssets: totalDeadAssets, newTombstones: totalNewTombstones })) {
      await this.sendNotification(report)
    }

    return report
  }

  private async scanLocalPath(watchPath: WatchPath): Promise<{ newAssets: number; deadAssets: number; newTombstones: number }> {
    const { path: dirPath, autoIndex } = watchPath
    
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Path does not exist: ${dirPath}`)
    }

    console.log(`📂 Scanning local path: ${dirPath}`)

    // Index the directory
    const assets = indexDirectory(dirPath)
    const existing = loadIndex()
    const existingHashes = new Set(existing.map(a => a.hash))
    const newAssets = assets.filter(a => !existingHashes.has(a.hash))

    // Add new assets to index
    const merged = [...existing, ...newAssets]
    saveIndex(merged)

    console.log(`   Found ${assets.length} assets, ${newAssets.length} new`)

    // Detect dead assets
    const deadAssets = this.detectDeadAssets(merged)

    // Auto-create tombstones if configured
    let newTombstones = 0
    if (this.config.autoTombstone) {
      for (const deadAsset of deadAssets) {
        const existingTombstones = listTombstones()
        if (!existingTombstones.find(t => t.originalPath === deadAsset.location)) {
          createTombstone({
            path: deadAsset.location,
            cause: `No activity for ${this.config.deadThresholdDays} days`,
            summary: deadAsset.summary,
            tags: deadAsset.tags
          })
          newTombstones++
        }
      }
    }

    return { newAssets: newAssets.length, deadAssets: deadAssets.length, newTombstones }
  }

  private async scanGitHubRepo(githubWatch: GitHubWatch): Promise<{ newAssets: number; deadAssets: number; newTombstones: number }> {
    if (!this.octokit) {
      throw new Error('GitHub token not configured')
    }

    console.log(`🌐 Scanning GitHub repo: ${githubWatch.repo}`)

    const assets = await indexGitHubRepo(githubWatch.repo)
    const existing = loadIndex()
    const existingHashes = new Set(existing.map(a => a.hash))
    const newAssets = assets.filter(a => !existingHashes.has(a.hash))

    const merged = [...existing, ...newAssets]
    saveIndex(merged)

    const deadAssets = this.detectDeadAssets(merged)

    let newTombstones = 0
    if (this.config.autoTombstone) {
      for (const deadAsset of deadAssets) {
        const existingTombstones = listTombstones()
        if (!existingTombstones.find(t => t.originalPath === deadAsset.location)) {
          createTombstone({
            path: deadAsset.location,
            cause: `No GitHub activity for ${this.config.deadThresholdDays} days`,
            summary: deadAsset.summary,
            tags: [...(deadAsset.tags || []), 'github']
          })
          newTombstones++
        }
      }
    }

    return { newAssets: newAssets.length, deadAssets: deadAssets.length, newTombstones }
  }

  private detectDeadAssets(assets: AssetMetadata[]): AssetMetadata[] {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - this.config.deadThresholdDays)

    return assets.filter(a => {
      // Already marked as dead
      if (!a.alive) return false

      // Check last updated time
      const updatedAt = new Date(a.updatedAt)
      return updatedAt < thresholdDate
    })
  }

  private shouldNotify(result: { newAssets: number; deadAssets: number; newTombstones: number }): boolean {
    if (this.config.notifications.channel === 'none') return false
    if (this.config.notifications.quietMode) {
      // Only notify if something interesting happened
      return result.newAssets > 0 || result.deadAssets > 0 || result.newTombstones > 0
    }
    return true
  }

  private async sendNotification(report: string): Promise<void> {
    const channel = this.config.notifications.channel

    if (channel === 'telegram') {
      // Use OpenClaw message system
      console.log('📱 Telegram notification ready')
    } else if (channel === 'discord') {
      console.log('💬 Discord notification ready')
    } else if (channel === 'slack') {
      console.log('💼 Slack notification ready')
    }
  }

  private generateScanReport(result: { duration: string; newAssets: number; deadAssets: number; newTombstones: number; errors: string[] }): string {
    return `
# 🪦 Auto-Scan Report

**Scan Time**: ${new Date().toISOString()}  
**Duration**: ${result.duration}s

## Summary
- 🆕 New Assets: ${result.newAssets}
- 💀 Dead Assets: ${result.deadAssets}
- 🪦 New Tombstones: ${result.newTombstones}

## Errors
${result.errors.length > 0 ? result.errors.map(e => `- ${e}`).join('\n') : 'No errors'}

---
*Generated by Cemetery Auto-Scanner 🤖*
`
  }
}

// ========== CLI Entry ==========

if (require.main === module) {
  const args = process.argv.slice(2)
  const command = args[0]

  async function main() {
    const scanner = new AutoScanner()

    switch (command) {
      case 'start':
        scanner.start()
        break

      case 'stop':
        scanner.stop()
        break

      case 'status':
        console.log(JSON.stringify(scanner.status(), null, 2))
        break

      case 'scan':
      case 'now':
        const report = await scanner.scanNow()
        console.log(report)
        break

      default:
        console.log(`
🪦 Auto Scanner - Background Service

用法:
  start                 启动后台扫描服务
  stop                  停止后台扫描
  status                查看扫描状态
  scan / now            立即执行扫描

示例:
  auto-scanner start
  auto-scanner status
  auto-scanner scan
        `)
    }
  }

  main().catch(console.error)
}
