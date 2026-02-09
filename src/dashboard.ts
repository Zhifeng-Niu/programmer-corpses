/**
 * 🪦 Smart Dashboard Generator
 * 
 * Human Off the Loop: Generate human-readable summaries
 * 
 * Features:
 * - Generate summaries of "what's in the cellar"
 * - Categorize by: alive projects, dormant projects, dead tombstones
 * - Auto-generate epitaphs and tags for discovered assets
 * - Show trends (new this week, died this month, resurrected)
 * - Output: Markdown report + optional JSON for machines
 */

import * as fs from 'fs'
import * as path from 'path'
import {
  loadIndex,
  saveIndex,
  getStats,
  AssetMetadata,
  AssetType,
  AssetSource,
  SearchFilter
} from './asset-index'
import {
  loadRegistry,
  listTombstones,
  getRegistryStats,
  Tombstone
} from './tombstone-registry'

// ========== Dashboard Configuration ==========

export interface DashboardConfig {
  outputFormat: 'markdown' | 'json' | 'both'
  outputPath: string
  includeTrends: boolean
  includeTombstones: boolean
  includeAssets: boolean
  dateRange: {
    newSince?: string     // ISO date
    diedSince?: string
    resurrectedSince?: string
  }
}

// ========== Trend Analysis ==========

interface TrendData {
  newThisWeek: number
  diedThisMonth: number
  resurrectedThisMonth: number
  avgLifespan: number
  topKillers: { cause: string; count: number }[]
  popularTags: { tag: string; count: number }[]
  languageBreakdown: { language: string; count: number }[]
}

// ========== Dashboard Generator ==========

export class DashboardGenerator {
  private config: DashboardConfig

  constructor(config?: Partial<DashboardConfig>) {
    this.config = {
      outputFormat: config?.outputFormat ?? 'markdown',
      outputPath: config?.outputPath ?? './DASHBOARD.md',
      includeTrends: config?.includeTrends ?? true,
      includeTombstones: config?.includeTombstones ?? true,
      includeAssets: config?.includeAssets ?? true,
      dateRange: config?.dateRange ?? {}
    }
  }

  /**
   * Generate complete dashboard
   */
  generate(): string {
    console.log('📊 Generating dashboard...')

    const assets = loadIndex()
    const tombstones = listTombstones()
    const assetStats = getStats()
    const tombstoneStats = getRegistryStats()

    const trends = this.config.includeTrends ? this.analyzeTrends(assets, tombstones) : null
    const categorizedAssets = this.categorizeAssets(assets)
    const categorizedTombstones = this.categorizeTombstones(tombstones)

    const dashboard = this.renderMarkdown({
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssets: assetStats.totalAssets,
        aliveAssets: assetStats.aliveAssets,
        deadAssets: assetStats.deadAssets,
        totalTombstones: tombstoneStats.total,
        resurrected: tombstoneStats.alive,
        stillDead: tombstoneStats.dead
      },
      trends,
      assets: categorizedAssets,
      tombstones: categorizedTombstones,
      assetStats,
      tombstoneStats
    })

    // Save output
    if (this.config.outputFormat === 'markdown' || this.config.outputFormat === 'both') {
      fs.writeFileSync(this.config.outputPath, dashboard)
      console.log(`📄 Dashboard saved to: ${this.config.outputPath}`)
    }

    if (this.config.outputFormat === 'json' || this.config.outputFormat === 'both') {
      const jsonPath = this.config.outputPath.replace(/\.md$/i, '.json')
      const jsonData = this.renderJSON({
        generatedAt: new Date().toISOString(),
        summary: {
          totalAssets: assetStats.totalAssets,
          aliveAssets: assetStats.aliveAssets,
          deadAssets: assetStats.deadAssets,
          totalTombstones: tombstoneStats.total,
          resurrected: tombstoneStats.alive,
          stillDead: tombstoneStats.dead
        },
        trends,
        assets: categorizedAssets,
        tombstones: categorizedTombstones,
        assetStats,
        tombstoneStats
      })
      fs.writeFileSync(jsonPath, jsonData)
      console.log(`📄 JSON dashboard saved to: ${jsonPath}`)
    }

    return dashboard
  }

  /**
   * Quick summary for notifications
   */
  generateDigest(): object {
    const assets = loadIndex()
    const tombstones = listTombstones()
    const assetStats = getStats()
    const tombstoneStats = getRegistryStats()

    const trends = this.analyzeTrends(assets, tombstones)

    return {
      title: '🪦 Your Digital Cellar Summary',
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssets: assetStats.totalAssets,
        alive: assetStats.aliveAssets,
        dead: assetStats.deadAssets,
        tombstones: tombstoneStats.total,
        resurrected: tombstoneStats.alive
      },
      highlights: {
        newThisWeek: trends.newThisWeek,
        diedThisMonth: trends.diedThisMonth,
        resurrected: trends.resurrectedThisMonth
      },
      topLanguages: trends.languageBreakdown.slice(0, 5)
    }
  }

  /**
   * Analyze trends from assets and tombstones
   */
  private analyzeTrends(assets: AssetMetadata[], tombstones: Tombstone[]): TrendData {
    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // New assets this week
    const newThisWeek = assets.filter(a => {
      const created = new Date(a.createdAt)
      return created >= oneWeekAgo
    }).length

    // Died this month
    const diedThisMonth = tombstones.filter(t => {
      const died = new Date(t.diedAt)
      return died >= oneMonthAgo && !t.resurrectedAt
    }).length

    // Resurrected this month
    const resurrectedThisMonth = tombstones.filter(t => {
      if (!t.resurrectedAt) return false
      const resurrected = new Date(t.resurrectedAt)
      return resurrected >= oneMonthAgo
    }).length

    // Average lifespan
    let totalLifespan = 0
    let lifespanCount = 0
    for (const t of tombstones) {
      if (t.resurrectedAt) {
        const died = new Date(t.diedAt)
        const resurrected = new Date(t.resurrectedAt)
        totalLifespan += (resurrected.getTime() - died.getTime()) / (1000 * 60 * 60 * 24)
        lifespanCount++
      }
    }
    const avgLifespan = lifespanCount > 0 ? Math.round(totalLifespan / lifespanCount) : 0

    // Top killers
    const killerCounts: Record<string, number> = {}
    for (const t of tombstones) {
      const killer = t.causeOfDeath.substring(0, 50)
      killerCounts[killer] = (killerCounts[killer] || 0) + 1
    }
    const topKillers = Object.entries(killerCounts)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Popular tags
    const tagCounts: Record<string, number> = {}
    for (const a of assets) {
      for (const tag of a.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }
    for (const t of tombstones) {
      for (const tag of t.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      }
    }
    const popularTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Language breakdown
    const langCounts: Record<string, number> = {}
    for (const a of assets) {
      if (a.language) {
        langCounts[a.language] = (langCounts[a.language] || 0) + 1
      }
    }
    const languageBreakdown = Object.entries(langCounts)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count)

    return {
      newThisWeek,
      diedThisMonth,
      resurrectedThisMonth,
      avgLifespan,
      topKillers,
      popularTags,
      languageBreakdown
    }
  }

  /**
   * Categorize assets by various criteria
   */
  private categorizeAssets(assets: AssetMetadata[]): {
    alive: AssetMetadata[]
    dormant: AssetMetadata[]
    byType: Record<string, AssetMetadata[]>
    byLanguage: Record<string, AssetMetadata[]>
    bySource: Record<string, AssetMetadata[]>
  } {
    const now = new Date()
    const dormantThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days

    const alive = assets.filter(a => a.alive && new Date(a.updatedAt) >= dormantThreshold)
    const dormant = assets.filter(a => a.alive && new Date(a.updatedAt) < dormantThreshold)

    const byType: Record<string, AssetMetadata[]> = {}
    for (const a of assets) {
      if (!byType[a.type]) byType[a.type] = []
      byType[a.type].push(a)
    }

    const byLanguage: Record<string, AssetMetadata[]> = {}
    for (const a of assets) {
      if (a.language) {
        if (!byLanguage[a.language]) byLanguage[a.language] = []
        byLanguage[a.language].push(a)
      }
    }

    const bySource: Record<string, AssetMetadata[]> = {}
    for (const a of assets) {
      if (!bySource[a.source]) bySource[a.source] = []
      bySource[a.source].push(a)
    }

    return { alive, dormant, byType, byLanguage, bySource }
  }

  /**
   * Categorize tombstones
   */
  private categorizeTombstones(tombstones: Tombstone[]): {
    all: Tombstone[]
    resurrected: Tombstone[]
    stillDead: Tombstone[]
    recent: Tombstone[]
    byCause: Record<string, Tombstone[]>
  } {
    const resurrected = tombstones.filter(t => t.resurrectedAt)
    const stillDead = tombstones.filter(t => !t.resurrectedAt)
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent = tombstones
      .sort((a, b) => new Date(b.diedAt).getTime() - new Date(a.diedAt).getTime())
      .slice(0, 10)

    const byCause: Record<string, Tombstone[]> = {}
    for (const t of tombstones) {
      const cause = t.causeOfDeath.substring(0, 30)
      if (!byCause[cause]) byCause[cause] = []
      byCause[cause].push(t)
    }

    return { all: tombstones, resurrected, stillDead, recent, byCause }
  }

  /**
   * Render dashboard as Markdown
   */
  private renderMarkdown(data: {
    generatedAt: string
    summary: any
    trends: TrendData | null
    assets: any
    tombstones: any
    assetStats: any
    tombstoneStats: any
  }): string {
    let md = `# 🪦 Your Digital Cellar\n\n`
    md += `**Generated**: ${data.generatedAt}\n\n`

    // Summary Section
    md += `## 📊 Summary\n\n`
    md += `| Metric | Count |\n`
    md += `|--------|-------|\n`
    md += `| 🟢 Alive Assets | ${data.summary.aliveAssets} |\n`
    md += `| 💀 Dead Assets | ${data.summary.deadAssets} |\n`
    md += `| 🪦 Total Tombstones | ${data.summary.totalTombstones} |\n`
    md += `| 🧟 Resurrected | ${data.summary.resurrected} |\n`
    md += `| ⚰️ Still Dead | ${data.summary.stillDead} |\n\n`

    // Trends Section
    if (data.trends) {
      md += `## 📈 Trends (This Period)\n\n`
      md += `- 🆕 **New this week**: ${data.trends.newThisWeek} assets\n`
      md += `- 💀 **Died this month**: ${data.trends.diedThisMonth} assets\n`
      md += `- 🧟 **Resurrected this month**: ${data.trends.resurrectedThisMonth} assets\n`
      if (data.trends.avgLifespan > 0) {
        md += `- ⏱️ **Average lifespan**: ${data.trends.avgLifespan} days\n`
      }
      md += `\n`

      // Top Languages
      if (data.trends.languageBreakdown.length > 0) {
        md += `### 🌍 Languages\n\n`
        md += data.trends.languageBreakdown
          .slice(0, 10)
          .map(l => `- ${l.language}: ${l.count}`)
          .join('\n')
        md += `\n\n`
      }

      // Popular Tags
      if (data.trends.popularTags.length > 0) {
        md += `### 🏷️ Popular Tags\n\n`
        md += data.trends.popularTags
          .map(t => `\`${t.tag}\` (${t.count})`)
          .join(' ')
        md += `\n\n`
      }

      // Top Killers
      if (data.trends.topKillers.length > 0) {
        md += `### 💀 Top Death Causes\n\n`
        md += data.trends.topKillers
          .map(k => `- ${k.cause}: ${k.count}`)
          .join('\n')
        md += `\n\n`
      }
    }

    // Assets Section
    if (this.config.includeAssets && data.assets) {
      md += `## 📦 Assets\n\n`

      if (data.assets.alive.length > 0) {
        md += `### 🟢 Alive Projects (${data.assets.alive.length})\n\n`
        md += data.assets.alive.slice(0, 10).map((a: AssetMetadata) => 
          `- ${a.name} [${a.type}] - ${a.language || '?'}`
        ).join('\n')
        if (data.assets.alive.length > 10) {
          md += `\n... and ${data.assets.alive.length - 10} more\n`
        }
        md += `\n\n`
      }

      if (data.assets.dormant.length > 0) {
        md += `😴 Dormant Projects (${data.assets.dormant.length})\n\n`
        md += data.assets.dormant.slice(0, 10).map((a: AssetMetadata) => 
          `- ${a.name} [${a.type}] - ${a.language || '?'}`
        ).join('\n')
        if (data.assets.dormant.length > 10) {
          md += `\n... and ${data.assets.dormant.length - 10} more\n`
        }
        md += `\n\n`
      }
    }

    // Tombstones Section
    if (this.config.includeTombstones && data.tombstones) {
      md += `## 🪦 Tombstones\n\n`

      if (data.tombstones.recent.length > 0) {
        md += `### Recently Deceased\n\n`
        for (const t of data.tombstones.recent.slice(0, 5)) {
          const status = t.resurrectedAt ? '🧟' : '💀'
          md += `${status} **${t.name}**\n`
          md += `   - 💀 ${t.causeOfDeath}\n`
          md += `   - 📜 "${t.epitaph}"\n`
          md += `   - 📅 ${t.diedAt.split('T')[0]}\n\n`
        }
      }

      if (data.tombstones.resurrected.length > 0) {
        md += `### 🧟 Resurrected (${data.tombstones.resurrected.length})\n\n`
        md += data.tombstones.resurrected.slice(0, 5).map((t: Tombstone) => 
          `- ${t.name} → ${t.resurrectedTo || 'unknown'}`
        ).join('\n')
        md += `\n\n`
      }

      if (data.tombstones.stillDead.length > 0) {
        md += `### ⚰️ Still Dead (${data.tombstones.stillDead.length})\n\n`
        md += data.tombstones.stillDead.slice(0, 10).map((t: Tombstone) => 
          `- ${t.name}: ${t.causeOfDeath}`
        ).join('\n')
        md += `\n\n`
      }
    }

    // Footer
    md += `---\n`
    md += `*🤖 Generated by Cemetery Dashboard*\n`
    md += `*Your Digital Cellar - ${data.generatedAt}*\n`

    return md
  }

  /**
   * Render dashboard as JSON
   */
  private renderJSON(data: any): string {
    return JSON.stringify(data, null, 2)
  }
}

// ========== CLI Entry ==========

if (require.main === module) {
  const args = process.argv.slice(2)
  const command = args[0]

  async function main() {
    switch (command) {
      case 'generate':
      case 'gen': {
        const output = args[1] || './DASHBOARD.md'
        const format = args.includes('--json') ? 'json' : 
                      args.includes('--both') ? 'both' : 'markdown'
        
        const generator = new DashboardGenerator({
          outputPath: output,
          outputFormat: format
        })
        
        const dashboard = generator.generate()
        console.log('\n' + dashboard)
        break
      }

      case 'digest':
      case 'summary': {
        const generator = new DashboardGenerator()
        const digest = generator.generateDigest()
        console.log('\n📊 Cellar Digest:')
        console.log(JSON.stringify(digest, null, 2))
        break
      }

      default:
        console.log(`
📊 Dashboard Generator - Smart Summaries

用法:
  dashboard generate [output]    生成仪表板
  dashboard digest                生成摘要（用于通知）

选项:
  --json                          输出 JSON 格式
  --both                          同时输出 Markdown 和 JSON

示例:
  cemetery dashboard generate
  cemetery dashboard generate ./reports/cellar.md
  cemetery dashboard generate --json
  cemetery dashboard digest
        `)
    }
  }

  main().catch(console.error)
}
