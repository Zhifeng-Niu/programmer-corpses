/**
 * 📦 Unified Asset Index - 统一资产索引
 *
 * De-location Storage: 不关心代码在哪，只关心它存在
 * 支持本地路径、GitHub 仓库、云存储等多种来源
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ========== 数据结构 ==========

export enum AssetType {
  CODE = 'code',
  TEXT = 'text',
  CONFIG = 'config',
  TEMPLATE = 'template',
  IDEA = 'idea',
  SNIPPET = 'snippet',
  DOCUMENT = 'document',
  UNKNOWN = 'unknown',
}

export enum AssetSource {
  LOCAL = 'local',
  GITHUB = 'github',
  CLOUD = 'cloud',
  MANUAL = 'manual',
}

export interface AssetMetadata {
  id: string
  name: string
  type: AssetType
  source: AssetSource
  location: string          // 原始位置（路径/URL）
  language?: string
  tags: string[]
  summary: string
  size: number              // bytes
  lineCount: number
  hash: string              // content hash for dedup
  createdAt: string
  updatedAt: string
  indexedAt: string
  author?: string
  repo?: string
  alive: boolean            // true = alive, false = tombstoned
  tombstoneId?: string      // link to tombstone if dead
  extra?: Record<string, any>
}

export interface IndexStats {
  totalAssets: number
  aliveAssets: number
  deadAssets: number
  byType: Record<string, number>
  bySource: Record<string, number>
  byLanguage: Record<string, number>
  totalSize: number
  totalLines: number
}

export interface SearchFilter {
  query?: string
  type?: AssetType
  source?: AssetSource
  language?: string
  tags?: string[]
  alive?: boolean
  limit?: number
}

// ========== Index Storage ==========

const INDEX_FILE = '.cemetery/asset-index.json'

function getIndexPath(basePath: string = process.cwd()): string {
  return path.join(basePath, INDEX_FILE)
}

function loadIndex(basePath?: string): AssetMetadata[] {
  const indexPath = getIndexPath(basePath)
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  }
  return []
}

function saveIndex(assets: AssetMetadata[], basePath?: string): void {
  const indexPath = getIndexPath(basePath)
  const dir = path.dirname(indexPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(indexPath, JSON.stringify(assets, null, 2))
}

// ========== Asset Detection ==========

const LANG_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++',
  '.c': 'C', '.h': 'C',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.sh': 'Shell', '.bash': 'Shell',
  '.css': 'CSS', '.scss': 'SCSS', '.less': 'LESS',
  '.html': 'HTML',
  '.json': 'JSON',
  '.yaml': 'YAML', '.yml': 'YAML',
  '.md': 'Markdown',
  '.sql': 'SQL',
  '.xml': 'XML',
  '.toml': 'TOML',
}

const TYPE_MAP: Record<string, AssetType> = {
  '.md': AssetType.DOCUMENT,
  '.txt': AssetType.TEXT,
  '.json': AssetType.CONFIG,
  '.yaml': AssetType.CONFIG,
  '.yml': AssetType.CONFIG,
  '.toml': AssetType.CONFIG,
  '.xml': AssetType.CONFIG,
  '.env': AssetType.CONFIG,
  '.gitignore': AssetType.CONFIG,
  '.editorconfig': AssetType.CONFIG,
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out',
  '.next', '.nuxt', '__pycache__', '.cache',
  'vendor', 'target', 'coverage', '.cemetery',
])

const IGNORE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.gitkeep',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
])

function detectLanguage(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase()
  return LANG_MAP[ext]
}

function detectType(filePath: string): AssetType {
  const ext = path.extname(filePath).toLowerCase()
  const basename = path.basename(filePath).toLowerCase()

  if (TYPE_MAP[ext]) return TYPE_MAP[ext]
  if (TYPE_MAP[basename]) return TYPE_MAP[basename]
  if (LANG_MAP[ext]) return AssetType.CODE

  return AssetType.UNKNOWN
}

function generateId(location: string, content: string): string {
  const hash = crypto.createHash('sha256')
    .update(`${location}:${content}`)
    .digest('hex')
    .substring(0, 12)
  const name = path.basename(location).replace(/[^a-zA-Z0-9]/g, '-').substring(0, 20)
  return `${name}-${hash}`
}

function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

function generateSummary(filePath: string, content: string): string {
  const lines = content.split('\n')
  // Look for first meaningful comment or docstring
  for (const line of lines.slice(0, 20)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('/**') || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      const cleaned = trimmed.replace(/^[/*#\s]+/, '').replace(/\*\/\s*$/, '').trim()
      if (cleaned.length > 10) return cleaned
    }
  }
  // Fallback: first non-empty line
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 0 && !trimmed.startsWith('import') && !trimmed.startsWith('require')) {
      return trimmed.substring(0, 100)
    }
  }
  return path.basename(filePath)
}

function extractTags(filePath: string, content: string): string[] {
  const tags: string[] = []
  const lang = detectLanguage(filePath)
  if (lang) tags.push(lang.toLowerCase())

  const type = detectType(filePath)
  if (type !== AssetType.UNKNOWN) tags.push(type)

  // Extract from path segments
  const segments = filePath.split(path.sep)
  for (const seg of segments) {
    if (seg.length > 2 && seg.length < 20 && !IGNORE_DIRS.has(seg)) {
      const cleaned = seg.replace(/\.[^.]+$/, '').toLowerCase()
      if (cleaned.length > 2 && !tags.includes(cleaned)) {
        tags.push(cleaned)
      }
    }
  }

  return tags.slice(0, 10)
}

// ========== Core Functions ==========

/**
 * Index a single file
 */
function indexFile(filePath: string, source: AssetSource = AssetSource.LOCAL, repo?: string): AssetMetadata | null {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return null
    if (stat.size > 5 * 1024 * 1024) return null // skip files > 5MB

    const basename = path.basename(filePath)
    if (IGNORE_FILES.has(basename)) return null

    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf-8')
    } catch {
      return null // binary file
    }

    const lineCount = content.split('\n').length

    return {
      id: generateId(filePath, content),
      name: basename,
      type: detectType(filePath),
      source,
      location: filePath,
      language: detectLanguage(filePath),
      tags: extractTags(filePath, content),
      summary: generateSummary(filePath, content),
      size: stat.size,
      lineCount,
      hash: hashContent(content),
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
      indexedAt: new Date().toISOString(),
      repo,
      alive: true,
    }
  } catch {
    return null
  }
}

/**
 * Recursively index a directory
 */
function indexDirectory(dirPath: string, repo?: string): AssetMetadata[] {
  const assets: AssetMetadata[] = []

  function walk(currentPath: string) {
    let items: string[]
    try {
      items = fs.readdirSync(currentPath)
    } catch {
      return
    }

    for (const item of items) {
      if (IGNORE_DIRS.has(item)) continue

      const fullPath = path.join(currentPath, item)
      let stat: fs.Stats
      try {
        stat = fs.statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (stat.isFile()) {
        const asset = indexFile(fullPath, AssetSource.LOCAL, repo)
        if (asset) assets.push(asset)
      }
    }
  }

  walk(dirPath)
  return assets
}

/**
 * Index a GitHub repo (generates placeholder assets from repo structure)
 */
async function indexGitHubRepo(repoUrl: string): Promise<AssetMetadata[]> {
  const { Octokit } = require('@octokit/rest')
  const assets: AssetMetadata[] = []

  // Parse repo URL
  const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  let owner: string
  let repo: string

  if (urlMatch) {
    owner = urlMatch[1]
    repo = urlMatch[2].replace('.git', '')
  } else {
    // Try owner/repo format
    const parts = repoUrl.split('/')
    if (parts.length < 2) {
      console.log(`⚠️ 无法解析 GitHub 仓库: ${repoUrl}`)
      return assets
    }
    owner = parts[0]
    repo = parts[1].replace('.git', '')
  }

  // Try to use token from config
  let token: string | undefined
  try {
    if (fs.existsSync('./cemetery.config.json')) {
      const config = JSON.parse(fs.readFileSync('./cemetery.config.json', 'utf-8'))
      token = config.token
    }
  } catch {}

  const octokit = new Octokit({ auth: token })

  try {
    // Get repo tree recursively
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true',
    })

    for (const item of data.tree) {
      if (item.type !== 'blob') continue
      if (!item.path) continue

      const basename = path.basename(item.path)
      if (IGNORE_FILES.has(basename)) continue

      // Check if in ignored directory
      const parts = item.path.split('/')
      if (parts.some((p: string) => IGNORE_DIRS.has(p))) continue

      const language = detectLanguage(item.path)
      const type = detectType(item.path)
      if (type === AssetType.UNKNOWN && !language) continue

      const asset: AssetMetadata = {
        id: generateId(`${owner}/${repo}/${item.path}`, item.sha || ''),
        name: basename,
        type,
        source: AssetSource.GITHUB,
        location: `https://github.com/${owner}/${repo}/blob/main/${item.path}`,
        language,
        tags: extractTags(item.path, ''),
        summary: `${owner}/${repo}: ${item.path}`,
        size: item.size || 0,
        lineCount: 0, // Can't know without fetching content
        hash: item.sha || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        indexedAt: new Date().toISOString(),
        repo: `${owner}/${repo}`,
        alive: true,
      }

      assets.push(asset)
    }

    console.log(`✅ 从 GitHub ${owner}/${repo} 索引了 ${assets.length} 个资产`)
  } catch (error: any) {
    console.log(`⚠️ GitHub 索引失败: ${error.message || error}`)
  }

  return assets
}

/**
 * Search assets
 */
function searchAssets(filter: SearchFilter, basePath?: string): AssetMetadata[] {
  const assets = loadIndex(basePath)
  let results = assets

  if (filter.alive !== undefined) {
    results = results.filter(a => a.alive === filter.alive)
  }

  if (filter.type) {
    results = results.filter(a => a.type === filter.type)
  }

  if (filter.source) {
    results = results.filter(a => a.source === filter.source)
  }

  if (filter.language) {
    results = results.filter(a =>
      a.language?.toLowerCase() === filter.language!.toLowerCase()
    )
  }

  if (filter.tags && filter.tags.length > 0) {
    results = results.filter(a =>
      filter.tags!.some(t => a.tags.includes(t.toLowerCase()))
    )
  }

  if (filter.query) {
    const q = filter.query.toLowerCase()
    const keywords = q.split(/\s+/)

    results = results.filter(a => {
      const searchable = [
        a.name,
        a.summary,
        a.location,
        a.language || '',
        ...a.tags,
        a.repo || '',
        a.author || '',
      ].join(' ').toLowerCase()

      return keywords.every(kw => searchable.includes(kw))
    })

    // Sort by relevance (more keyword hits = higher)
    results.sort((a, b) => {
      const aText = [a.name, a.summary, ...a.tags].join(' ').toLowerCase()
      const bText = [b.name, b.summary, ...b.tags].join(' ').toLowerCase()
      const aScore = keywords.reduce((s, kw) => s + (aText.includes(kw) ? 1 : 0), 0)
      const bScore = keywords.reduce((s, kw) => s + (bText.includes(kw) ? 1 : 0), 0)
      return bScore - aScore
    })
  }

  if (filter.limit) {
    results = results.slice(0, filter.limit)
  }

  return results
}

/**
 * Get index statistics
 */
function getStats(basePath?: string): IndexStats {
  const assets = loadIndex(basePath)

  const stats: IndexStats = {
    totalAssets: assets.length,
    aliveAssets: assets.filter(a => a.alive).length,
    deadAssets: assets.filter(a => !a.alive).length,
    byType: {},
    bySource: {},
    byLanguage: {},
    totalSize: 0,
    totalLines: 0,
  }

  for (const a of assets) {
    stats.byType[a.type] = (stats.byType[a.type] || 0) + 1
    stats.bySource[a.source] = (stats.bySource[a.source] || 0) + 1
    if (a.language) {
      stats.byLanguage[a.language] = (stats.byLanguage[a.language] || 0) + 1
    }
    stats.totalSize += a.size
    stats.totalLines += a.lineCount
  }

  return stats
}

/**
 * List assets by type
 */
function listByType(type: string, basePath?: string): AssetMetadata[] {
  return searchAssets({ type: type as AssetType }, basePath)
}

// ========== Exports ==========

export {
  loadIndex,
  saveIndex,
  indexFile,
  indexDirectory,
  indexGitHubRepo,
  searchAssets,
  getStats,
  listByType,
  getIndexPath,
}

// ========== CLI Entry ==========

if (require.main === module) {
  const args = process.argv.slice(2)
  const command = args[0]

  async function main() {
    switch (command) {
      case 'index': {
        const target = args[1]
        if (!target) {
          console.log('用法: asset-index index <path|github-url>')
          return
        }

        let assets: AssetMetadata[]
        if (target.includes('github.com') || target.includes('/')) {
          assets = await indexGitHubRepo(target)
        } else {
          const fullPath = path.resolve(target)
          console.log(`📂 索引 ${fullPath}...`)
          assets = indexDirectory(fullPath)
        }

        // Merge with existing index
        const existing = loadIndex()
        const existingIds = new Set(existing.map(a => a.hash))
        const newAssets = assets.filter(a => !existingIds.has(a.hash))
        const merged = [...existing, ...newAssets]
        saveIndex(merged)

        console.log(`\n📊 索引完成:`)
        console.log(`   新增: ${newAssets.length}`)
        console.log(`   跳过 (已存在): ${assets.length - newAssets.length}`)
        console.log(`   总计: ${merged.length}`)
        break
      }

      case 'search': {
        const query = args.slice(1).join(' ')
        const results = searchAssets({ query, limit: 20 })
        if (results.length === 0) {
          console.log('😢 没有找到匹配的资产')
        } else {
          console.log(`\n🔍 找到 ${results.length} 个资产:\n`)
          for (const r of results) {
            const status = r.alive ? '🟢' : '💀'
            console.log(`${status} ${r.name} [${r.type}] ${r.language || ''}`)
            console.log(`   📍 ${r.location}`)
            console.log(`   📝 ${r.summary}`)
            console.log(`   🏷️ ${r.tags.map(t => `#${t}`).join(' ')}`)
            console.log('')
          }
        }
        break
      }

      case 'stats': {
        const stats = getStats()
        console.log(`\n📊 资产统计`)
        console.log('═'.repeat(50))
        console.log(`   总资产: ${stats.totalAssets}`)
        console.log(`   存活: ${stats.aliveAssets}`)
        console.log(`   已死亡: ${stats.deadAssets}`)
        console.log(`   总大小: ${(stats.totalSize / 1024).toFixed(1)} KB`)
        console.log(`   总行数: ${stats.totalLines.toLocaleString()}`)
        console.log(`\n   按类型:`)
        for (const [k, v] of Object.entries(stats.byType)) {
          console.log(`     ${k}: ${v}`)
        }
        console.log(`\n   按来源:`)
        for (const [k, v] of Object.entries(stats.bySource)) {
          console.log(`     ${k}: ${v}`)
        }
        console.log(`\n   按语言:`)
        for (const [k, v] of Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
          console.log(`     ${k}: ${v}`)
        }
        break
      }

      default:
        console.log(`
📦 Asset Index - 统一资产索引

用法:
  index <path>          索引本地目录
  index <owner/repo>    索引 GitHub 仓库
  search <query>        搜索资产
  stats                 统计信息

示例:
  asset-index index ./src
  asset-index index Zhifeng-Niu/programmer-corpses
  asset-index search "auth utils"
  asset-index stats
        `)
    }
  }

  main().catch(console.error)
}
