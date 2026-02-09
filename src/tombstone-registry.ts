/**
 * 🪦 Tombstone Registry - 墓碑注册处
 *
 * 代码死了，留下墓碑 + 标签 + 摘要 = 可搜索的遗产
 * Tombstone as Epitaph: 死代码不会消失，只是换了种存在方式
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  loadIndex,
  saveIndex,
  AssetMetadata,
  AssetType,
  AssetSource,
} from './asset-index'

// ========== 数据结构 ==========

export interface Tombstone {
  id: string
  name: string
  causeOfDeath: string
  epitaph: string
  tags: string[]
  summary: string
  assetId?: string         // linked asset id
  originalPath: string
  language?: string
  lineCount: number
  author?: string
  repo?: string
  createdAt: string
  diedAt: string
  resurrectedAt?: string   // null if still dead
  resurrectedTo?: string   // where it was revived
  extra?: Record<string, any>
}

export interface TombstoneCreateOptions {
  path: string
  cause: string
  epitaph?: string
  tags?: string[]
  summary?: string
  author?: string
  repo?: string
}

// ========== Registry Storage ==========

const REGISTRY_FILE = '.cemetery/tombstone-registry.json'

function getRegistryPath(basePath: string = process.cwd()): string {
  return path.join(basePath, REGISTRY_FILE)
}

function loadRegistry(basePath?: string): Tombstone[] {
  const registryPath = getRegistryPath(basePath)
  if (fs.existsSync(registryPath)) {
    return JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
  }
  return []
}

function saveRegistry(tombstones: Tombstone[], basePath?: string): void {
  const registryPath = getRegistryPath(basePath)
  const dir = path.dirname(registryPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(registryPath, JSON.stringify(tombstones, null, 2))
}

// ========== Epitaph Generator ==========

const DEATH_REASONS_TO_EPITAPHS: Record<string, string[]> = {
  'deprecated': [
    '曾经辉煌一时，如今只剩 @deprecated 标记',
    '技术栈更新换代，它被时间淘汰了',
    '新框架来了，老兵退役',
  ],
  'refactor': [
    '不是我不好，是重构的人觉得可以更好',
    '它的灵魂在重构中得到了升华',
    '代码没死，只是换了个身份重新出发',
  ],
  'unused': [
    '写出来的那天，就是它最后被阅读的一天',
    '从未被 import，也从未被需要',
    'Dead code detector 的最爱',
  ],
  'requirements-changed': [
    '需求变了，它没跟上',
    '产品经理的一句话，代码的一生',
    'PRD 改了，代码殉职了',
  ],
  'default': [
    '安息吧，你曾经编译通过',
    'RIP - 你的 console.log 永远留在了 git history',
    '它死了，但它的注释还在误导后人',
    '这里躺着一段代码，它做到了 TODO 永远不做的事',
  ],
}

function generateEpitaph(cause: string): string {
  const lowerCause = cause.toLowerCase()
  let pool = DEATH_REASONS_TO_EPITAPHS['default']

  for (const [key, epitaphs] of Object.entries(DEATH_REASONS_TO_EPITAPHS)) {
    if (lowerCause.includes(key)) {
      pool = epitaphs
      break
    }
  }

  return pool[Math.floor(Math.random() * pool.length)]
}

function generateSummaryFromFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    // Try to find a doc comment
    for (const line of lines.slice(0, 30)) {
      const trimmed = line.trim()
      if (trimmed.startsWith('/**') || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        const cleaned = trimmed.replace(/^[/*#\s]+/, '').replace(/\*\/\s*$/, '').trim()
        if (cleaned.length > 10) return cleaned
      }
    }

    // Count exports/functions
    const exports = (content.match(/export\s+(function|class|const|interface|type|enum)/g) || []).length
    const functions = (content.match(/function\s+\w+/g) || []).length
    const classes = (content.match(/class\s+\w+/g) || []).length

    const parts: string[] = []
    if (exports) parts.push(`${exports} exports`)
    if (functions) parts.push(`${functions} functions`)
    if (classes) parts.push(`${classes} classes`)

    if (parts.length > 0) {
      return `${path.basename(filePath)}: ${parts.join(', ')} (${lines.length} lines)`
    }

    return `${path.basename(filePath)} - ${lines.length} lines`
  } catch {
    return path.basename(filePath)
  }
}

function extractTagsFromFile(filePath: string): string[] {
  const tags: string[] = []
  const ext = path.extname(filePath).toLowerCase()

  // Language tag
  const langMap: Record<string, string> = {
    '.ts': 'typescript', '.js': 'javascript', '.py': 'python',
    '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.cpp': 'cpp', '.c': 'c', '.swift': 'swift',
    '.rb': 'ruby', '.php': 'php',
  }
  if (langMap[ext]) tags.push(langMap[ext])

  // Path-based tags
  const segments = filePath.split(path.sep)
  for (const seg of segments) {
    const cleaned = seg.replace(/\.[^.]+$/, '').toLowerCase()
    if (cleaned.length > 2 && cleaned.length < 20) {
      if (!['src', 'lib', 'dist', 'build', 'index'].includes(cleaned)) {
        tags.push(cleaned)
      }
    }
  }

  // Try to extract from file content
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    // Look for @tags or #tags in comments
    const tagMatches = content.match(/@tag[s]?\s+([^\n]+)/gi)
    if (tagMatches) {
      for (const m of tagMatches) {
        const t = m.replace(/@tags?\s+/i, '').trim().split(/[,\s]+/)
        tags.push(...t.filter(x => x.length > 1))
      }
    }
  } catch {}

  return [...new Set(tags)].slice(0, 10)
}

// ========== Core Functions ==========

/**
 * Create a tombstone for a file/path
 */
function createTombstone(options: TombstoneCreateOptions): Tombstone {
  const { path: assetPath, cause, epitaph, tags, summary, author, repo } = options

  let lineCount = 0
  let language: string | undefined
  let autoSummary = summary || ''
  let autoTags = tags || []

  const ext = path.extname(assetPath).toLowerCase()
  const langMap: Record<string, string> = {
    '.ts': 'TypeScript', '.js': 'JavaScript', '.py': 'Python',
    '.go': 'Go', '.rs': 'Rust', '.java': 'Java',
  }
  language = langMap[ext]

  // If path exists, read metadata from it
  if (fs.existsSync(assetPath)) {
    try {
      const content = fs.readFileSync(assetPath, 'utf-8')
      lineCount = content.split('\n').length
    } catch {}

    if (!autoSummary) autoSummary = generateSummaryFromFile(assetPath)
    if (autoTags.length === 0) autoTags = extractTagsFromFile(assetPath)
  }

  if (!autoSummary) autoSummary = path.basename(assetPath)
  if (autoTags.length === 0) autoTags = [path.basename(assetPath).replace(/\.[^.]+$/, '')]

  const id = `tomb-${crypto.createHash('md5')
    .update(`${assetPath}:${Date.now()}`)
    .digest('hex')
    .substring(0, 8)}`

  const tombstone: Tombstone = {
    id,
    name: path.basename(assetPath),
    causeOfDeath: cause,
    epitaph: epitaph || generateEpitaph(cause),
    tags: autoTags,
    summary: autoSummary,
    originalPath: assetPath,
    language,
    lineCount,
    author,
    repo,
    createdAt: new Date().toISOString(),
    diedAt: new Date().toISOString(),
  }

  // Save to registry
  const registry = loadRegistry()
  registry.push(tombstone)
  saveRegistry(registry)

  // Mark asset as dead in index
  const index = loadIndex()
  const asset = index.find(a =>
    a.location === assetPath || a.location.endsWith(assetPath)
  )
  if (asset) {
    asset.alive = false
    asset.tombstoneId = tombstone.id
    saveIndex(index)
  }

  return tombstone
}

/**
 * Search tombstones
 */
function searchTombstones(query: string, basePath?: string): Tombstone[] {
  const registry = loadRegistry(basePath)
  const keywords = query.toLowerCase().split(/\s+/)

  return registry.filter(t => {
    const searchable = [
      t.name,
      t.causeOfDeath,
      t.epitaph,
      t.summary,
      t.originalPath,
      t.language || '',
      ...t.tags,
      t.author || '',
    ].join(' ').toLowerCase()

    return keywords.every(kw => searchable.includes(kw))
  })
}

/**
 * List all tombstones
 */
function listTombstones(basePath?: string): Tombstone[] {
  return loadRegistry(basePath)
}

/**
 * Get a tombstone by ID
 */
function getTombstone(id: string, basePath?: string): Tombstone | undefined {
  const registry = loadRegistry(basePath)
  return registry.find(t => t.id === id)
}

/**
 * Mark a tombstone as resurrected
 */
function resurrectTombstone(id: string, target: string, basePath?: string): Tombstone | undefined {
  const registry = loadRegistry(basePath)
  const tombstone = registry.find(t => t.id === id)

  if (tombstone) {
    tombstone.resurrectedAt = new Date().toISOString()
    tombstone.resurrectedTo = target
    saveRegistry(registry, basePath)

    // Mark asset as alive again
    if (tombstone.assetId) {
      const index = loadIndex(basePath)
      const asset = index.find(a => a.id === tombstone.assetId)
      if (asset) {
        asset.alive = true
        saveIndex(index, basePath)
      }
    }
  }

  return tombstone
}

/**
 * Format tombstone for display
 */
function formatTombstone(t: Tombstone): string {
  const status = t.resurrectedAt ? '🧟 已复活' : '💀 已死亡'

  return `
🪦 ─────────────────────────────────────
   ${t.name} [${t.id}]
   ─────────────────────────────────────
   💀 死因: ${t.causeOfDeath}
   📜 墓志铭: "${t.epitaph}"
   📍 原位置: ${t.originalPath}
   📅 死亡日期: ${t.diedAt.split('T')[0]}
   💻 语言: ${t.language || '未知'}
   📏 行数: ${t.lineCount}
   🏷️ 标签: ${t.tags.map(t => `#${t}`).join(' ')}
   📝 摘要: ${t.summary}
   📊 状态: ${status}${t.resurrectedAt ? `\n   🔄 复活至: ${t.resurrectedTo}` : ''}
🪦 ─────────────────────────────────────
`
}

/**
 * Get registry statistics
 */
function getRegistryStats(basePath?: string): {
  total: number
  alive: number
  dead: number
  byLanguage: Record<string, number>
  byCause: Record<string, number>
  recentDeaths: Tombstone[]
} {
  const registry = loadRegistry(basePath)

  const stats = {
    total: registry.length,
    alive: registry.filter(t => t.resurrectedAt).length,
    dead: registry.filter(t => !t.resurrectedAt).length,
    byLanguage: {} as Record<string, number>,
    byCause: {} as Record<string, number>,
    recentDeaths: registry
      .sort((a, b) => new Date(b.diedAt).getTime() - new Date(a.diedAt).getTime())
      .slice(0, 5),
  }

  for (const t of registry) {
    if (t.language) {
      stats.byLanguage[t.language] = (stats.byLanguage[t.language] || 0) + 1
    }
    const cause = t.causeOfDeath.substring(0, 30)
    stats.byCause[cause] = (stats.byCause[cause] || 0) + 1
  }

  return stats
}

// ========== Exports ==========

export {
  loadRegistry,
  saveRegistry,
  createTombstone,
  searchTombstones,
  listTombstones,
  getTombstone,
  resurrectTombstone,
  formatTombstone,
  getRegistryStats,
  generateEpitaph,
}

// ========== CLI Entry ==========

if (require.main === module) {
  const args = process.argv.slice(2)
  const command = args[0]

  async function main() {
    switch (command) {
      case 'create': {
        const assetPath = args[1]
        const cause = args[2] || '寿终正寝'

        if (!assetPath) {
          console.log('用法: tombstone-registry create <path> <cause>')
          return
        }

        const tombstone = createTombstone({ path: assetPath, cause })
        console.log(formatTombstone(tombstone))
        console.log(`✅ 墓碑已创建: ${tombstone.id}`)
        break
      }

      case 'search': {
        const query = args.slice(1).join(' ')
        if (!query) {
          console.log('用法: tombstone-registry search <query>')
          return
        }

        const results = searchTombstones(query)
        if (results.length === 0) {
          console.log('😢 没有找到匹配的墓碑')
        } else {
          console.log(`\n🔍 找到 ${results.length} 个墓碑:\n`)
          for (const t of results) {
            console.log(formatTombstone(t))
          }
        }
        break
      }

      case 'list': {
        const tombstones = listTombstones()
        if (tombstones.length === 0) {
          console.log('🏛️ 墓地空空如也，还没有代码死掉')
        } else {
          console.log(`\n🪦 墓碑列表 (${tombstones.length} 个):\n`)
          for (const t of tombstones) {
            const status = t.resurrectedAt ? '🧟' : '💀'
            console.log(`${status} ${t.id} | ${t.name} | ${t.causeOfDeath}`)
          }
        }
        break
      }

      case 'stats': {
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
        break
      }

      default:
        console.log(`
🪦 Tombstone Registry - 墓碑注册处

用法:
  create <path> <cause>    为代码创建墓碑
  search <query>           搜索墓碑
  list                     列出所有墓碑
  stats                    墓碑统计

示例:
  tombstone-registry create ./src/old-auth.ts "被新认证模块替代"
  tombstone-registry search "auth"
  tombstone-registry list
  tombstone-registry stats
        `)
    }
  }

  main().catch(console.error)
}
