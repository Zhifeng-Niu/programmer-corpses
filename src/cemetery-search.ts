/**
 * 🏛️ Cemetery Search Engine - 墓地搜索引擎
 *
 * 在代码墓地中搜索和发现死掉的代码
 * 支持多种搜索方式和智能排序
 */

import { Octokit } from '@octokit/rest'
import * as fs from 'fs'
import * as path from 'path'

// ========== 数据结构 ==========

export interface SearchResult {
  id: string
  type: SearchResultType
  relevance: number
  tombstone: TombstoneData
  highlights: string[]
}

export enum SearchResultType {
  EXACT_MATCH = 'EXACT_MATCH',       // 🎯 精确匹配
  FUZZY_MATCH = 'FUZZY_MATCH',       // 🔍 模糊匹配
  TAG_MATCH = 'TAG_MATCH',           // 🏷️ 标签匹配
  SEMANTIC_MATCH = 'SEMANTIC_MATCH', // 🧠 语义匹配
  AUTHOR_MATCH = 'AUTHOR_MATCH',     // 👮 作者匹配
}

export interface TombstoneData {
  id: string
  repo: string
  path: string
  cause: string
  age: string
  date: string
  killer: string
  tags?: string[]
  language?: string
  lineCount?: number
  stars?: number
  description?: string
}

export interface SearchQuery {
  keywords: string[]
  author?: string
  language?: string
  tags?: string[]
  dateRange?: {
    start: string
    end: string
  }
  sortBy?: SearchSortType
  limit?: number
}

export enum SearchSortType {
  RELEVANCE = 'RELEVANCE',     // 🎯 相关度
  DATE = 'DATE',               // 📅 日期
  STARS = 'STARS',             // ⭐ 星标
  SIZE = 'SIZE',               // 📦 大小
  RANDOM = 'RANDOM',           // 🎲 随机
}

export interface SearchOptions {
  useFuzzy?: boolean
  threshold?: number
  caseSensitive?: boolean
  includeContent?: boolean
}

// ========== 墓地搜索引擎 ==========

export class CemeterySearchEngine {
  private octokit: Octokit | null = null
  private cemeteryData: TombstoneData[] = []
  private index: Map<string, Set<string>> = new Map()

  constructor(token?: string) {
    if (token) {
      this.octokit = new Octokit({ auth: token })
    }
  }

  /**
   * 📖 加载墓地数据
   */
  async loadCemeteryData(source: string = './cemetery-report.md'): Promise<void> {
    console.log(`📖 加载墓地数据: ${source}`)

    if (fs.existsSync(source)) {
      const content = fs.readFileSync(source, 'utf-8')
      this.cemeteryData = this.parseCemeteryReport(content)
    } else if (this.octokit) {
      // 从 GitHub 加载
      await this.loadFromGitHub(source)
    }

    this.buildIndex()
    console.log(`✅ 加载了 ${this.cemeteryData.length} 个墓碑`)
  }

  /**
   * 🔍 搜索
   */
  async search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const {
      useFuzzy = true,
      threshold = 0.5,
      caseSensitive = false,
      includeContent = false
    } = options

    console.log(`🔍 搜索: ${query.keywords.join(' ')}`)

    for (const tombstone of this.cemeteryData) {
      let relevance = 0
      const type: SearchResultType[] = []
      const highlights: string[] = []

      // 1. 关键词匹配
      for (const keyword of query.keywords) {
        const kw = caseSensitive ? keyword : keyword.toLowerCase()

        // 精确匹配
        if (this.exactMatch(tombstone, kw, caseSensitive)) {
          relevance += 1.0
          type.push(SearchResultType.EXACT_MATCH)
          highlights.push(`精确匹配: ${keyword}`)
        }
        // 模糊匹配
        else if (useFuzzy && this.fuzzyMatch(tombstone, kw, threshold, caseSensitive)) {
          const similarity = this.calculateSimilarity(tombstone, kw, caseSensitive)
          relevance += similarity * 0.7
          type.push(SearchResultType.FUZZY_MATCH)
          highlights.push(`模糊匹配: ${keyword} (${(similarity * 100).toFixed(1)}%)`)
        }
      }

      // 2. 标签匹配
      if (query.tags && query.tags.length > 0 && tombstone.tags) {
        const tagMatches = query.tags.filter(t => tombstone.tags?.includes(t))
        if (tagMatches.length > 0) {
          relevance += tagMatches.length * 0.3
          type.push(SearchResultType.TAG_MATCH)
          highlights.push(`标签匹配: ${tagMatches.join(', ')}`)
        }
      }

      // 3. 作者匹配
      if (query.author && tombstone.killer.toLowerCase().includes(query.author.toLowerCase())) {
        relevance += 0.5
        type.push(SearchResultType.AUTHOR_MATCH)
        highlights.push(`作者匹配: ${query.author}`)
      }

      // 4. 语言匹配
      if (query.language && tombstone.language === query.language) {
        relevance += 0.3
      }

      // 5. 日期范围匹配
      if (query.dateRange) {
        const date = new Date(tombstone.date)
        const start = new Date(query.dateRange.start)
        const end = new Date(query.dateRange.end)

        if (date >= start && date <= end) {
          relevance += 0.2
        }
      }

      // 如果有匹配，添加到结果
      if (relevance > 0) {
        results.push({
          id: tombstone.id,
          type: type[0] || SearchResultType.FUZZY_MATCH,
          relevance,
          tombstone,
          highlights
        })
      }
    }

    // 排序
    this.sortResults(results, query.sortBy || SearchSortType.RELEVANCE)

    // 限制结果数量
    const limit = query.limit || 10
    return results.slice(0, limit)
  }

  /**
   * 🎲 随机浏览
   */
  randomBrowse(count: number = 5): TombstoneData[] {
    const shuffled = [...this.cemeteryData].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  /**
   * 📊 获取统计信息
   */
  getStatistics(): {
    total: number
    byLanguage: Map<string, number>
    byAuthor: Map<string, number>
    byTags: Map<string, number>
    dateRange: { earliest: string; latest: string }
  } {
    const byLanguage = new Map<string, number>()
    const byAuthor = new Map<string, number>()
    const byTags = new Map<string, number>()
    let earliest = this.cemeteryData[0]?.date || ''
    let latest = this.cemeteryData[0]?.date || ''

    for (const tombstone of this.cemeteryData) {
      // 语言统计
      if (tombstone.language) {
        byLanguage.set(tombstone.language, (byLanguage.get(tombstone.language) || 0) + 1)
      }

      // 作者统计
      if (tombstone.killer) {
        byAuthor.set(tombstone.killer, (byAuthor.get(tombstone.killer) || 0) + 1)
      }

      // 标签统计
      if (tombstone.tags) {
        for (const tag of tombstone.tags) {
          byTags.set(tag, (byTags.get(tag) || 0) + 1)
        }
      }

      // 日期范围
      if (tombstone.date < earliest) earliest = tombstone.date
      if (tombstone.date > latest) latest = tombstone.date
    }

    return {
      total: this.cemeteryData.length,
      byLanguage,
      byAuthor,
      byTags,
      dateRange: { earliest, latest }
    }
  }

  /**
   * 🔥 热门墓碑
   */
  getTrending(limit: number = 10): TombstoneData[] {
    return [...this.cemeteryData]
      .sort((a, b) => (b.stars || 0) - (a.stars || 0))
      .slice(0, limit)
  }

  /**
   * 🆕 最新墓碑
   */
  getLatest(limit: number = 10): TombstoneData[] {
    return [...this.cemeteryData]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  }

  /**
   * 💡 推荐墓碑
   */
  getRecommendations(query: string, limit: number = 5): TombstoneData[] {
    const recommendations = new Map<string, { tombstone: TombstoneData; score: number }>()

    // 基于关键词的推荐
    const keywords = this.extractKeywords(query)
    for (const keyword of keywords) {
      const matches = this.index.get(keyword.toLowerCase())
      if (matches) {
        for (const id of matches) {
          const tombstone = this.cemeteryData.find(t => t.id === id)
          if (tombstone) {
            const existing = recommendations.get(id)
            const score = (existing?.score || 0) + 1
            recommendations.set(id, { tombstone, score })
          }
        }
      }
    }

    return [...recommendations.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.tombstone)
  }

  /**
   * 📝 显示搜索结果
   */
  displayResults(results: SearchResult[]): void {
    console.log('\n🔍 搜索结果')
    console.log('═'.repeat(70))

    if (results.length === 0) {
      console.log('😢 没有找到匹配的墓碑')
      console.log('💡 尝试使用不同的关键词')
      return
    }

    console.log(`✅ 找到 ${results.length} 个结果:\n`)

    results.forEach((result, i) => {
      console.log(`${i + 1}. 🪦 ${result.tombstone.id}`)
      console.log(`   ${result.tombstone.cause}`)
      console.log(`   📦 ${result.tombstone.repo}/${result.tombstone.path}`)
      console.log(`   📅 ${result.tombstone.date}`)

      if (result.tombstone.language) {
        console.log(`   💻 ${result.tombstone.language}`)
      }

      if (result.tombstone.tags && result.tombstone.tags.length > 0) {
        console.log(`   🏷️ ${result.tombstone.tags.map(t => `#${t}`).join(' ')}`)
      }

      console.log(`   🎯 相关度: ${(result.relevance * 100).toFixed(1)}%`)

      if (result.highlights.length > 0) {
        console.log(`   ✨ ${result.highlights.join(' | ')}`)
      }

      console.log('')
    })
  }

  // ========== 私有方法 ==========

  /**
   * 📖 解析墓地报告
   */
  private parseCemeteryReport(content: string): TombstoneData[] {
    const tombstones: TombstoneData[] = []
    const lines = content.split('\n')

    let currentRepo = ''
    let currentTombstone: Partial<TombstoneData> | null = null

    for (const line of lines) {
      if (line.startsWith('## 📂')) {
        currentRepo = line.replace('## 📂 ', '').trim()
      } else if (line.includes('📖 ')) {
        if (currentTombstone) {
          tombstones.push(currentTombstone as TombstoneData)
        }
        currentTombstone = {
          repo: currentRepo,
          id: '',
          path: '',
          cause: '',
          age: '',
          date: '',
          killer: ''
        }
      } else if (line.includes('💀 死因:')) {
        if (currentTombstone) {
          currentTombstone.cause = line.split(': ')[1]?.trim() || ''
        }
      } else if (line.includes('墓碑编号:')) {
        if (currentTombstone) {
          currentTombstone.id = line.split(': ')[1]?.trim() || ''
        }
      } else if (line.includes('📦 原位置:')) {
        if (currentTombstone) {
          const fullPath = line.split(': ')[1]?.trim() || ''
          currentTombstone.path = fullPath
        }
      } else if (line.includes('⏰ 享年:')) {
        if (currentTombstone) {
          currentTombstone.age = line.split(': ')[1]?.trim() || ''
        }
      } else if (line.includes('📅 忌日:')) {
        if (currentTombstone) {
          currentTombstone.date = line.split(': ')[1]?.trim() || ''
        }
      } else if (line.includes('👮 凶手:')) {
        if (currentTombstone) {
          currentTombstone.killer = line.split(': ')[1]?.trim() || ''
        }
      } else if (line.includes('⭐')) {
        if (currentTombstone && line.includes('Stars:')) {
          const match = line.match(/Stars:\s*(\d+)/)
          if (match) {
            currentTombstone.stars = parseInt(match[1])
          }
        }
      }
    }

    if (currentTombstone && currentTombstone.id) {
      tombstones.push(currentTombstone as TombstoneData)
    }

    return tombstones
  }

  /**
   * 🌐 从 GitHub 加载
   */
  private async loadFromGitHub(repo: string): Promise<void> {
    // TODO: 实现 GitHub API 加载
    console.log('⚠️ GitHub 加载功能待实现')
  }

  /**
   * 🗂️ 构建索引
   */
  private buildIndex(): void {
    this.index.clear()

    for (const tombstone of this.cemeteryData) {
      // 索引 ID
      const idWords = tombstone.id.split(/[-_]/)
      for (const word of idWords) {
        if (word.length > 2) {
          this.addToIndex(word.toLowerCase(), tombstone.id)
        }
      }

      // 索引路径
      const pathWords = tombstone.path.split(/[/\\-_.]/)
      for (const word of pathWords) {
        if (word.length > 2) {
          this.addToIndex(word.toLowerCase(), tombstone.id)
        }
      }

      // 索引标签
      if (tombstone.tags) {
        for (const tag of tombstone.tags) {
          this.addToIndex(tag.toLowerCase(), tombstone.id)
        }
      }

      // 索引作者
      if (tombstone.killer) {
        this.addToIndex(tombstone.killer.toLowerCase(), tombstone.id)
      }
    }
  }

  /**
   * ➕ 添加到索引
   */
  private addToIndex(keyword: string, id: string): void {
    if (!this.index.has(keyword)) {
      this.index.set(keyword, new Set())
    }
    this.index.get(keyword)!.add(id)
  }

  /**
   * 🎯 精确匹配
   */
  private exactMatch(tombstone: TombstoneData, keyword: string, caseSensitive: boolean): boolean {
    const searchFields = [
      tombstone.id,
      tombstone.path,
      tombstone.cause,
      ...(tombstone.tags || []),
      tombstone.language,
      tombstone.killer
    ].filter(Boolean)

    for (const field of searchFields) {
      if (!field) continue
      const value = caseSensitive ? field : field.toLowerCase()
      if (value.includes(keyword)) {
        return true
      }
    }

    return false
  }

  /**
   * 🔍 模糊匹配
   */
  private fuzzyMatch(tombstone: TombstoneData, keyword: string, threshold: number, caseSensitive: boolean): boolean {
    const searchFields = [
      tombstone.id,
      tombstone.path,
      tombstone.cause
    ].filter(Boolean)

    for (const field of searchFields) {
      const similarity = this.stringSimilarity(
        caseSensitive ? field : field.toLowerCase(),
        keyword
      )
      if (similarity >= threshold) {
        return true
      }
    }

    return false
  }

  /**
   * 📊 计算相似度
   */
  private calculateSimilarity(tombstone: TombstoneData, keyword: string, caseSensitive: boolean): number {
    let maxSimilarity = 0

    const searchFields = [tombstone.id, tombstone.path, tombstone.cause]
    for (const field of searchFields) {
      const similarity = this.stringSimilarity(
        caseSensitive ? field : field.toLowerCase(),
        keyword
      )
      maxSimilarity = Math.max(maxSimilarity, similarity)
    }

    return maxSimilarity
  }

  /**
   * 📝 字符串相似度（Levenshtein 距离）
   */
  private stringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1
    if (s1.length === 0 || s2.length === 0) return 0

    const matrix = Array(s2.length + 1).fill(0).map(() => Array(s1.length + 1).fill(0))

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        )
      }
    }

    const distance = matrix[s2.length][s1.length]
    const maxLen = Math.max(s1.length, s2.length)

    return 1 - distance / maxLen
  }

  /**
   * 📊 排序结果
   */
  private sortResults(results: SearchResult[], sortBy: SearchSortType): void {
    switch (sortBy) {
      case SearchSortType.RELEVANCE:
        results.sort((a, b) => b.relevance - a.relevance)
        break
      case SearchSortType.DATE:
        results.sort((a, b) => new Date(b.tombstone.date).getTime() - new Date(a.tombstone.date).getTime())
        break
      case SearchSortType.STARS:
        results.sort((a, b) => (b.tombstone.stars || 0) - (a.tombstone.stars || 0))
        break
      case SearchSortType.SIZE:
        results.sort((a, b) => (b.tombstone.lineCount || 0) - (a.tombstone.lineCount || 0))
        break
      case SearchSortType.RANDOM:
        results.sort(() => Math.random() - 0.5)
        break
    }
  }

  /**
   * 🔑 提取关键词
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  }
}

// ========== CLI 入口 ==========

const args = process.argv.slice(2)
const command = args[0]

async function cliMain() {
  const engine = new CemeterySearchEngine()
  await engine.loadCemeteryData()

  switch (command) {
    case 'search': {
      const keywords = args.slice(1).filter(a => !a.startsWith('--'))
      if (keywords.length === 0) {
        console.log('用法: cemetery-search search <keywords> [--limit 10] [--sort relevance]')
        return
      }

      const query: SearchQuery = {
        keywords,
        limit: 10,
        sortBy: SearchSortType.RELEVANCE
      }

      const results = await engine.search(query)
      engine.displayResults(results)
      break
    }

    case 'random': {
      const count = parseInt(args[1]) || 5
      console.log(`\n🎲 随机浏览 ${count} 个墓碑\n`)
      const tombstones = engine.randomBrowse(count)

      tombstones.forEach((t, i) => {
        console.log(`${i + 1}. 🪦 ${t.id}`)
        console.log(`   ${t.cause}`)
        console.log(`   📦 ${t.repo}/${t.path}`)
        console.log('')
      })
      break
    }

    case 'trending': {
      const limit = parseInt(args[1]) || 10
      console.log(`\n🔥 热门墓碑 TOP ${limit}\n`)
      const tombstones = engine.getTrending(limit)

      tombstones.forEach((t, i) => {
        console.log(`${i + 1}. ⭐ ${t.stars} - ${t.id}`)
        console.log(`   ${t.cause}`)
        console.log('')
      })
      break
    }

    case 'stats': {
      const stats = engine.getStatistics()

      console.log('\n📊 墓地统计')
      console.log('═'.repeat(50))
      console.log(`总墓碑数: ${stats.total}`)
      console.log(`日期范围: ${stats.dateRange.earliest} ~ ${stats.dateRange.latest}`)

      console.log('\n按语言:')
      for (const [lang, count] of stats.byLanguage.entries()) {
        console.log(`  ${lang}: ${count}`)
      }

      console.log('\n按作者:')
      for (const [author, count] of Array.from(stats.byAuthor.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
        console.log(`  ${author}: ${count}`)
      }

      console.log('\n按标签:')
      for (const [tag, count] of Array.from(stats.byTags.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        console.log(`  #${tag}: ${count}`)
      }
      break
    }

    case 'recommend': {
      const query = args[1]
      if (!query) {
        console.log('用法: cemetery-search recommend "<query>"')
        return
      }

      const recommendations = engine.getRecommendations(query)
      console.log(`\n💡 基于 "${query}" 的推荐:\n`)

      recommendations.forEach((t, i) => {
        console.log(`${i + 1}. 🪦 ${t.id}`)
        console.log(`   ${t.cause}`)
        console.log(`   📦 ${t.repo}/${t.path}`)
        console.log('')
      })
      break
    }

    case 'help':
    default:
      console.log(`
🏛️ Cemetery Search Engine - 墓地搜索引擎

用法:
  search <keywords>     🔍 搜索墓碑
  random [count]        🎲 随机浏览
  trending [limit]      🔥 热门墓碑
  stats                 📊 统计信息
  recommend <query>     💡 智能推荐
  help                  📖 帮助

示例:
  cemetery-search search auth utils
  cemetery-search random 5
  cemetery-search trending 10
  cemetery-search recommend "用户认证"

排序选项:
  relevance    🎯 相关度
  date         📅 日期
  stars        ⭐ 星标
  size         📦 大小
  random       🎲 随机
      `)
  }
}

// 只在直接运行时执行 CLI
if (require.main === module) {
  cliMain().catch(console.error)
}

