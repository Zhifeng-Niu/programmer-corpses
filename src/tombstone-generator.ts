/**
 * 🪦 Tombstone Generator - 墓碑生成器
 *
 * 为死掉的代码生成精美的墓碑
 * 支持多种风格和自定义模板
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ========== 数据结构 ==========

export interface CorpseMetadata {
  id: string
  originalRepo: string
  originalPath: string
  deathReason: string
  deathDate: string
  files: CorpseFile[]
  author?: string
  tags?: string[]
  language?: string
  lineCount?: number
}

export interface CorpseFile {
  name: string
  path: string
  size: number
  lineCount: number
  lastModified: string
}

export interface TombstoneStyle {
  name: string
  template: string
  emojis: {
    tombstone: string
    skull: string
    date: string
    killer: string
    repo: string
    flower: string
  }
}

export interface TombstoneConfig {
  style: TombstoneStyleType
  includeStats: boolean
  includeAuthors: boolean
  includeResurrectInfo: boolean
  customTemplate?: string
}

export enum TombstoneStyleType {
  CLASSIC = 'CLASSIC',           // 🪦 经典墓碑
  MODERN = 'MODERN',             // 🎨 现代简约
  EMOJI = 'EMOJI',               // 😀 Emoji 风格
  ASCII = 'ASCII',               // 💻 ASCII 艺术
  MINIMAL = 'MINIMAL',           // ⬜ 极简主义
  CYBERPUNK = 'CYBERPUNK',       // 🌆 赛博朋克
}

// ========== 墓碑生成器 ==========

export class TombstoneGenerator {
  private config: TombstoneConfig
  private styles: Map<TombstoneStyleType, TombstoneStyle>

  constructor(config: Partial<TombstoneConfig> = {}) {
    this.config = {
      style: config.style || TombstoneStyleType.CLASSIC,
      includeStats: config.includeStats ?? true,
      includeAuthors: config.includeAuthors ?? true,
      includeResurrectInfo: config.includeResurrectInfo ?? true,
      customTemplate: config.customTemplate
    }

    this.styles = this.initStyles()
  }

  /**
   * 🪦 生成墓碑
   */
  generate(metadata: CorpseMetadata): string {
    const style = this.styles.get(this.config.style) || this.styles.get(TombstoneStyleType.CLASSIC)!

    if (this.config.customTemplate) {
      return this.generateFromTemplate(metadata, this.config.customTemplate)
    }

    return this.generateFromStyle(metadata, style)
  }

  /**
   * 🎨 从风格生成墓碑
   */
  private generateFromStyle(metadata: CorpseMetadata, style: TombstoneStyle): string {
    let tombstone = style.template

    // 替换变量
    tombstone = tombstone.replace(/\{id\}/g, metadata.id)
    tombstone = tombstone.replace(/\{reason\}/g, metadata.deathReason)
    tombstone = tombstone.replace(/\{repo\}/g, metadata.originalRepo)
    tombstone = tombstone.replace(/\{path\}/g, metadata.originalPath)
    tombstone = tombstone.replace(/\{date\}/g, this.formatDate(metadata.deathDate))
    tombstone = tombstone.replace(/\{author\}/g, metadata.author || '未知')

    // 替换 emoji
    tombstone = tombstone.replace(/\{emoji:tombstone\}/g, style.emojis.tombstone)
    tombstone = tombstone.replace(/\{emoji:skull\}/g, style.emojis.skull)
    tombstone = tombstone.replace(/\{emoji:date\}/g, style.emojis.date)
    tombstone = tombstone.replace(/\{emoji:killer\}/g, style.emojis.killer)
    tombstone = tombstone.replace(/\{emoji:repo\}/g, style.emojis.repo)
    tombstone = tombstone.replace(/\{emoji:flower\}/g, style.emojis.flower)

    // 添加统计信息
    if (this.config.includeStats) {
      const stats = this.generateStats(metadata)
      tombstone = tombstone.replace(/\{stats\}/g, stats)
    } else {
      tombstone = tombstone.replace(/\{stats\}/g, '')
    }

    // 添加作者信息
    if (this.config.includeAuthors && metadata.author) {
      tombstone = tombstone.replace(/\{author_section\}/g, this.generateAuthorSection(metadata))
    } else {
      tombstone = tombstone.replace(/\{author_section\}/g, '')
    }

    // 添加复活信息
    if (this.config.includeResurrectInfo) {
      tombstone = tombstone.replace(/\{resurrect\}/g, this.generateResurrectInfo(metadata))
    } else {
      tombstone = tombstone.replace(/\{resurrect\}/g, '')
    }

    // 添加标签
    if (metadata.tags && metadata.tags.length > 0) {
      tombstone = tombstone.replace(/\{tags\}/g, metadata.tags.map(t => `#${t}`).join(' '))
    } else {
      tombstone = tombstone.replace(/\{tags\}/g, '')
    }

    return tombstone
  }

  /**
   * 📝 从自定义模板生成墓碑
   */
  private generateFromTemplate(metadata: CorpseMetadata, template: string): string {
    let result = template

    // 替换所有变量
    result = result.replace(/\{\{id\}\}/g, metadata.id)
    result = result.replace(/\{\{reason\}\}/g, metadata.deathReason)
    result = result.replace(/\{\{repo\}\}/g, metadata.originalRepo)
    result = result.replace(/\{\{path\}\}/g, metadata.originalPath)
    result = result.replace(/\{\{date\}\}/g, this.formatDate(metadata.deathDate))
    result = result.replace(/\{\{author\}\}/g, metadata.author || '未知')
    result = result.replace(/\{\{language\}\}/g, metadata.language || '未知')
    result = result.replace(/\{\{lineCount\}\}/g, (metadata.lineCount || 0).toString())
    result = result.replace(/\{\{fileCount\}\}/g, metadata.files.length.toString())

    // 替换文件列表
    if (result.includes('{{files}}')) {
      const fileList = metadata.files.map(f => `  - ${f.name} (${this.formatSize(f.size)})`).join('\n')
      result = result.replace(/\{\{files\}\}/g, fileList)
    }

    return result
  }

  /**
   * 📊 生成统计信息
   */
  private generateStats(metadata: CorpseMetadata): string {
    const totalLines = metadata.files.reduce((sum, f) => sum + f.lineCount, 0)
    const totalSize = metadata.files.reduce((sum, f) => sum + f.size, 0)

    return `
📊 统计信息:
   文件数量: ${metadata.files.length}
   代码行数: ${totalLines.toLocaleString()}
   总大小: ${this.formatSize(totalSize)}
   语言: ${metadata.language || '未知'}
`
  }

  /**
   * 👮 生成作者信息
   */
  private generateAuthorSection(metadata: CorpseMetadata): string {
    return `
👮 凶手: ${metadata.author}
`
  }

  /**
   * 🧟 生成复活信息
   */
  private generateResurrectInfo(metadata: CorpseMetadata): string {
    return `
🧟 诈尸方式:
   使用命令: cemetery resurrect ${metadata.id}
   或访问: https://github.com/programmer-corpses/cemetery/tree/main/${metadata.id}

💡 提示: 代码没死透，只是去墓地度假了
`
  }

  /**
   * 📅 格式化日期
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * 📦 格式化文件大小
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /**
   * 🎨 初始化风格
   */
  private initStyles(): Map<TombstoneStyleType, TombstoneStyle> {
    const styles = new Map<TombstoneStyleType, TombstoneStyle>()

    // 经典风格
    styles.set(TombstoneStyleType.CLASSIC, {
      name: '经典',
      template: `
{emoji:tombstone} 墓碑编号: {id}
═════════════════════════════════════════════════════════

{emoji:skull} 死因: {reason}
{emoji:repo} 原位置: {repo}/{path}
{emoji:date} 忌日: {date}
{emoji:flower} 生前事迹: {tags}{author_section}{stats}
{emoji:tombstone} 墓志铭:
   "这里埋葬着曾经有用的代码
    它没做错什么，只是被更好的方案替代了"

{resurrect}
═════════════════════════════════════════════════════════
`,
      emojis: {
        tombstone: '🪦',
        skull: '💀',
        date: '📅',
        killer: '👮',
        repo: '📦',
        flower: '🌸'
      }
    })

    // 现代简约
    styles.set(TombstoneStyleType.MODERN, {
      name: '现代',
      template: `
┌─────────────────────────────────────────────────────────┐
│  🪦 {id}                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💀 {reason}                                            │
│  📦 {repo}/{path}                                       │
│  📅 {date}                                              │
│  👮 凶手: {author}                                      │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  📊 统计: {fileCount} 文件 | {lineCount} 行 | {language} │
└─────────────────────────────────────────────────────────┘

💡 "代码永恒，只是换了个地方存在"
`,
      emojis: {
        tombstone: '🪦',
        skull: '💀',
        date: '📅',
        killer: '👮',
        repo: '📦',
        flower: '🌸'
      }
    })

    // Emoji 风格
    styles.set(TombstoneStyleType.EMOJI, {
      name: 'Emoji',
      template: `
🪦🪦🪦 墓碑编号: {id} 🪦🪦🪦

💀💀💀 死因: {reason} 💀💀💀

📦 原位置: {repo}/{path}
📅 忌日: {date}
👮 凶手: {author}
🏷️ 标签: {tags}

{stats}

🌸🌸🌸 墓志铭 🌸🌸🌸

"代码没有死透，它在墓地等你"

🧟 诈尸方式: cemetery resurrect {id}

🪦🪦🪦🪦🪦🪦🪦🪦🪦🪦🪦🪦🪦🪦🪦
`,
      emojis: {
        tombstone: '🪦',
        skull: '💀',
        date: '📅',
        killer: '👮',
        repo: '📦',
        flower: '🌸'
      }
    })

    // ASCII 艺术风格
    styles.set(TombstoneStyleType.ASCII, {
      name: 'ASCII',
      template: `
        ___
       |   |
       | {id} |
       |___|
      _______
     |       |
     | R.I.P |
     |_______|

 💀 死因: {reason}
 📦 位置: {repo}/{path}
 📅 忌日: {date}
 👮 凶手: {author}

{stats}

    "Here lies code, once useful, now retired"
          🧟 cemetery resurrect {id}
`,
      emojis: {
        tombstone: '🪦',
        skull: '💀',
        date: '📅',
        killer: '👮',
        repo: '📦',
        flower: '🌸'
      }
    })

    // 极简风格
    styles.set(TombstoneStyleType.MINIMAL, {
      name: '极简',
      template: `
🪦 {id}

{reason}
{repo}/{path}
{date}

{stats}
cemetery resurrect {id}
`,
      emojis: {
        tombstone: '🪦',
        skull: '💀',
        date: '📅',
        killer: '👮',
        repo: '📦',
        flower: '🌸'
      }
    })

    // 赛博朋克风格
    styles.set(TombstoneStyleType.CYBERPUNK, {
      name: '赛博朋克',
      template: `
╔═════════════════════════════════════════════════════════╗
║  🌃 CYBER CEMETERY - 墓碑编号: {id}                🌃  ║
╠═════════════════════════════════════════════════════════╣
║                                                         ║
║  💀 死因: {reason}                                ║
║  📦 位置: {repo}/{path}                        ║
║  📅 时刻: {date}                                   ║
║  👮 执行者: {author}                             ║
║                                                         ║
╠═════════════════════════════════════════════════════════╣
║  📊 数据档案                                            ║
{stats}
╠═════════════════════════════════════════════════════════╣
║                                                         ║
║  ⚡ "在数字世界里，死亡只是另一种存在形式"              ║
║                                                         ║
║  🧟 复活协议: cemetery resurrect {id}          ║
║                                                         ║
╚═════════════════════════════════════════════════════════╝
`,
      emojis: {
        tombstone: '🪦',
        skull: '💀',
        date: '📅',
        killer: '👮',
        repo: '📦',
        flower: '🌸'
      }
    })

    return styles
  }

  /**
   * 🎨 预览所有风格
   */
  previewStyles(metadata: CorpseMetadata): Map<TombstoneStyleType, string> {
    const previews = new Map<TombstoneStyleType, string>()

    for (const [styleType, style] of this.styles.entries()) {
      const tombstone = this.generateFromStyle(metadata, style)
      previews.set(styleType, tombstone)
    }

    return previews
  }

  /**
   * 📄 保存墓碑到文件
   */
  saveToFile(metadata: CorpseMetadata, outputPath: string): void {
    const tombstone = this.generate(metadata)

    // 确保目录存在
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, tombstone, 'utf-8')
    console.log(`✅ 墓碑已保存: ${outputPath}`)
  }

  /**
   * 🏛️ 批量生成墓碑
   */
  generateBatch(metadatas: CorpseMetadata[]): Map<string, string> {
    const tombstones = new Map<string, string>()

    for (const metadata of metadatas) {
      const tombstone = this.generate(metadata)
      tombstones.set(metadata.id, tombstone)
    }

    return tombstones
  }
}

// ========== 工具函数 ==========

/**
 * 🆔 生成墓碑 ID
 */
export function generateTombstoneId(repo: string, path: string): string {
  const hash = crypto.createHash('md5')
    .update(`${repo}:${path}:${Date.now()}`)
    .digest('hex')
    .substring(0, 8)
  return `${repo.replace(/\//g, '-')}-${hash}`
}

/**
 * 📁 从目录生成墓碑元数据
 */
export function generateMetadataFromDir(
  dirPath: string,
  repo: string,
  reason: string
): CorpseMetadata {
  const files: CorpseFile[] = []
  let totalLines = 0

  function scanDir(currentPath: string, relativePath: string) {
    const items = fs.readdirSync(currentPath)

    for (const item of items) {
      const fullPath = path.join(currentPath, item)
      const relPath = path.join(relativePath, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        scanDir(fullPath, relPath)
      } else if (stat.isFile()) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const lineCount = content.split('\n').length

        files.push({
          name: item,
          path: relPath,
          size: stat.size,
          lineCount,
          lastModified: stat.mtime.toISOString()
        })

        totalLines += lineCount
      }
    }
  }

  scanDir(dirPath, '')

  return {
    id: generateTombstoneId(repo, dirPath),
    originalRepo: repo,
    originalPath: dirPath,
    deathReason: reason,
    deathDate: new Date().toISOString(),
    files,
    lineCount: totalLines
  }
}

// ========== CLI 入口 ==========

const args = process.argv.slice(2)
const command = args[0]

async function cliMain() {
  const config: Partial<TombstoneConfig> = {
    style: TombstoneStyleType.CLASSIC,
    includeStats: true,
    includeAuthors: true,
    includeResurrectInfo: true
  }

  const generator = new TombstoneGenerator(config)

  switch (command) {
    case 'generate': {
      const dirPath = args[1]
      const repo = args[2] || 'unknown-repo'
      const reason = args[3] || '寿终正寝'

      if (!dirPath) {
        console.log('用法: tombstone-generator generate <dir-path> <repo> <reason>')
        return
      }

      const metadata = generateMetadataFromDir(dirPath, repo, reason)
      const tombstone = generator.generate(metadata)

      console.log(tombstone)

      const outputPath = `./tombstones/${metadata.id}.md`
      generator.saveToFile(metadata, outputPath)
      break
    }

    case 'preview': {
      const metadata: CorpseMetadata = {
        id: 'example-tombstone',
        originalRepo: 'my-old-project',
        originalPath: 'src/utils/deprecated',
        deathReason: '被新方案替代',
        deathDate: new Date().toISOString(),
        files: [
          { name: 'helper.ts', path: 'helper.ts', size: 1024, lineCount: 50, lastModified: new Date().toISOString() }
        ],
        author: 'Developer',
        tags: ['deprecated', 'legacy'],
        language: 'TypeScript',
        lineCount: 50
      }

      console.log('🎨 预览所有墓碑风格:\n')

      const previews = generator.previewStyles(metadata)
      for (const [style, tombstone] of previews.entries()) {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`风格: ${style}`)
        console.log('='.repeat(60))
        console.log(tombstone)
      }
      break
    }

    case 'help':
    default:
      console.log(`
🪦 Tombstone Generator - 墓碑生成器

用法:
  generate <dir> <repo> <reason>   生成墓碑
  preview                         预览所有风格
  help                            显示帮助

示例:
  tombstone-generator generate ./old-code my-repo "代码太老了"
  tombstone-generator preview

风格选项:
  CLASSIC    - 🪦 经典墓碑
  MODERN     - 🎨 现代简约
  EMOJI      - 😀 Emoji 风格
  ASCII      - 💻 ASCII 艺术
  MINIMAL    - ⬜ 极简主义
  CYBERPUNK  - 🌆 赛博朋克
      `)
  }
}

// 只在直接运行时执行 CLI
if (require.main === module) {
  cliMain().catch(console.error)
}

