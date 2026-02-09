/**
 * 🧟 Enhanced Zombie Detector - 增强版诈尸检测系统
 *
 * 检测死掉的代码被新项目复用的情况
 * 支持多种检测算法和智能分析
 */

import { Octokit } from '@octokit/rest'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ========== 数据结构 ==========

export interface ZombieCase {
  corpseRepo: string
  corpsePath: string
  zombieRepo: string
  zombiePath: string
  similarity: number
  resurrectionType: ResurrectionType
  confidence: number
  details: ZombieDetails
}

export interface ZombieDetails {
  matchedFunctions?: string[]
  matchedClasses?: string[]
  matchedPatterns?: string[]
  lineCount?: number
  lastModified?: string
  authors?: string[]
}

export enum ResurrectionType {
  CLONE = 'CLONE', // 🔄 完全克隆
  REFACTOR = 'REFACTOR', // 🔨 重构改进
  MODULARIZE = 'MODULARIZE', // 📦 模块化提取
  AI_DERIVED = 'AI_DERIVED', // 🧠 AI 派生
  INSPIRED = 'INSPIRED', // 💡 灵感参考
}

export interface DetectionConfig {
  token?: string
  owner: string
  similarityThreshold: number
  enableAI?: boolean
  enableGitHistory?: boolean
  excludePatterns?: string[]
}

export interface ScanResult {
  zombies: ZombieCase[]
  scanned: number
  timestamp: string
  summary: ScanSummary
}

export interface ScanSummary {
  highConfidence: number
  mediumConfidence: number
  lowConfidence: number
  totalResurrections: number
}

// ========== 诈尸检测器 ==========

export class EnhancedZombieDetector {
  private octokit: Octokit | null = null
  private config: DetectionConfig
  private cache: Map<string, any> = new Map()

  constructor(config: DetectionConfig) {
    this.config = config
    if (config.token) {
      this.octokit = new Octokit({ auth: config.token })
    }
  }

  /**
   * 🔍 扫描新仓库检测诈尸
   */
  async scanRepository(targetRepo: string): Promise<ScanResult> {
    console.log(`🧟 开始扫描 ${targetRepo} 检测诈尸...\n`)

    const zombies: ZombieCase[] = []
    let scanned = 0

    // 1. 读取墓地数据
    const cemeteryData = await this.loadCemeteryData()

    // 2. 扫描目标仓库的代码
    const targetFiles = await this.scanRepositoryFiles(targetRepo)
    scanned = targetFiles.length

    console.log(`📂 扫描了 ${scanned} 个文件\n`)

    // 3. 对比检测
    for (const targetFile of targetFiles) {
      const matches = await this.detectZombies(targetFile, cemeteryData, targetRepo)
      zombies.push(...matches)
    }

    // 4. 生成摘要
    const summary = this.generateSummary(zombies)

    // 5. 显示结果
    this.displayResults(zombies, summary)

    return {
      zombies,
      scanned,
      timestamp: new Date().toISOString(),
      summary
    }
  }

  /**
   * 🏛️ 加载墓地数据
   */
  private async loadCemeteryData(): Promise<any[]> {
    // 尝试从本地文件加载
    const reportPath = './cemetery-report.md'
    if (fs.existsSync(reportPath)) {
      const report = fs.readFileSync(reportPath, 'utf-8')
      return this.parseCemeteryReport(report)
    }

    // 尝试从 GitHub 墓地仓库加载
    if (this.octokit) {
      try {
        // TODO: 从指定的墓地仓库加载墓碑数据
      } catch (error) {
        console.log('⚠️ 无法从 GitHub 加载墓地数据')
      }
    }

    // 返回内置示例数据
    return this.getBuiltinCemeteryData()
  }

  /**
   * 📖 解析墓地报告
   */
  private parseCemeteryReport(report: string): any[] {
    const corpses: any[] = []
    const lines = report.split('\n')

    let currentRepo = ''
    let currentCorpse: any = null

    for (const line of lines) {
      if (line.startsWith('## 📂')) {
        currentRepo = line.replace('## 📂 ', '').trim()
      } else if (line.includes('🪦 墓碑编号:')) {
        if (currentCorpse) {
          corpses.push(currentCorpse)
        }
        currentCorpse = {
          repo: currentRepo,
          id: line.split(': ')[1]?.trim() || '',
          path: '',
          content: '',
          keywords: []
        }
      } else if (line.includes('💀 死因:')) {
        if (currentCorpse) {
          currentCorpse.cause = line.split(': ')[1]?.trim() || ''
        }
      } else if (line.includes('📦 原位置:')) {
        if (currentCorpse) {
          const fullPath = line.split(': ')[1]?.trim() || ''
          currentCorpse.path = fullPath
          currentCorpse.keywords = this.extractKeywords(fullPath)
        }
      }
    }

    if (currentCorpse) {
      corpses.push(currentCorpse)
    }

    return corpses
  }

  /**
   * 🔍 扫描仓库文件
   */
  private async scanRepositoryFiles(repo: string): Promise<any[]> {
    const files: any[] = []

    if (!this.octokit) {
      console.log('⚠️ 未配置 GitHub Token，使用模拟数据')
      return this.getMockFiles(repo)
    }

    try {
      const { data: contents } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo,
        path: ''
      })

      if (Array.isArray(contents)) {
        for (const item of contents) {
          if (item.type === 'file' && this.isCodeFile(item.name)) {
            const content = await this.fetchFileContent(repo, item.path)
            files.push({
              path: item.path,
              name: item.name,
              content,
              hash: this.hashContent(content)
            })
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ 扫描仓库失败: ${error}`)
    }

    return files
  }

  /**
   * 🧟 检测诈尸
   */
  private async detectZombies(
    targetFile: any,
    cemeteryData: any[],
    targetRepo: string
  ): Promise<ZombieCase[]> {
    const zombies: ZombieCase[] = []

    for (const corpse of cemeteryData) {
      // 1. 关键词匹配
      const keywordMatch = this.matchKeywords(targetFile, corpse)
      if (keywordMatch.score > 0.3) {
        const similarity = await this.calculateSimilarity(targetFile, corpse)

        if (similarity >= this.config.similarityThreshold) {
          zombies.push({
            corpseRepo: corpse.repo || 'unknown',
            corpsePath: corpse.path,
            zombieRepo: targetRepo,
            zombiePath: targetFile.path,
            similarity: Math.round(similarity * 100) / 100,
            resurrectionType: this.classifyResurrection(similarity, keywordMatch),
            confidence: this.calculateConfidence(similarity, keywordMatch),
            details: {
              matchedPatterns: keywordMatch.patterns,
              lineCount: targetFile.content.split('\n').length
            }
          })
        }
      }
    }

    return zombies
  }

  /**
   * 📊 计算相似度
   */
  private async calculateSimilarity(targetFile: any, corpse: any): Promise<number> {
    // 1. 文件名相似度
    const nameSimilarity = this.stringSimilarity(
      targetFile.name,
      path.basename(corpse.path)
    )

    // 2. 内容相似度（如果有内容的话）
    let contentSimilarity = 0
    if (corpse.content && targetFile.content) {
      contentSimilarity = this.contentSimilarity(targetFile.content, corpse.content)
    }

    // 3. 结构相似度（函数/类名）
    const structureSimilarity = this.structureSimilarity(targetFile, corpse)

    // 加权平均
    return (
      nameSimilarity * 0.3 +
      contentSimilarity * 0.5 +
      structureSimilarity * 0.2
    )
  }

  /**
   * 🎯 字符串相似度（Jaro-Winkler）
   */
  private stringSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1
    if (s1.length === 0 || s2.length === 0) return 0

    const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1
    if (matchWindow < 0) return 0

    const s1Matches = new Array(s1.length).fill(false)
    const s2Matches = new Array(s2.length).fill(false)

    let matches = 0
    let transpositions = 0

    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchWindow)
      const end = Math.min(i + matchWindow + 1, s2.length)

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue
        s1Matches[i] = s2Matches[j] = true
        matches++
        break
      }
    }

    if (matches === 0) return 0

    let k = 0
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue
      while (!s2Matches[k]) k++
      if (s1[i] !== s2[k]) transpositions++
      k++
    }

    const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
    const prefix = Math.min(4, s1.length)
    let prefixMatch = 0
    for (let i = 0; i < prefix; i++) {
      if (s1[i] === s2[i]) prefixMatch++
      else break
    }

    return jaro + prefixMatch * 0.1 * (1 - jaro)
  }

  /**
   * 📄 内容相似度（基于词频）
   */
  private contentSimilarity(content1: string, content2: string): number {
    const words1 = this.tokenize(content1)
    const words2 = this.tokenize(content2)

    const intersection = words1.filter(w => words2.includes(w))
    const union = [...new Set([...words1, ...words2])]

    return union.length > 0 ? intersection.length / union.length : 0
  }

  /**
   * 🏗️ 结构相似度
   */
  private structureSimilarity(file: any, corpse: any): number {
    const extractNames = (content: string) => {
      const names: string[] = []
      const patterns = [
        /function\s+(\w+)/g,
        /class\s+(\w+)/g,
        /const\s+(\w+)\s*=\s*\(/g,
        /(\w+)\s*:\s*function/g
      ]

      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          names.push(match[1])
        }
      }

      return names
    }

    const targetNames = extractNames(file.content || '')
    const corpseNames = extractNames(corpse.content || '')

    if (targetNames.length === 0 && corpseNames.length === 0) return 0

    const intersection = targetNames.filter(n => corpseNames.includes(n))
    const union = [...new Set([...targetNames, ...corpseNames])]

    return union.length > 0 ? intersection.length / union.length : 0
  }

  /**
   * 🔑 关键词匹配
   */
  private matchKeywords(file: any, corpse: any): { score: number; patterns: string[] } {
    const patterns: string[] = []
    let score = 0

    const fileLower = file.name.toLowerCase()
    const pathLower = file.path.toLowerCase()

    for (const keyword of corpse.keywords || []) {
      const kwLower = keyword.toLowerCase()
      if (fileLower.includes(kwLower) || pathLower.includes(kwLower)) {
        score += 0.3
        patterns.push(keyword)
      }
    }

    return { score: Math.min(score, 1), patterns }
  }

  /**
   * 🏷️ 提取关键词
   */
  private extractKeywords(filePath: string): string[] {
    const filename = path.basename(filePath)
    return filename
      .replace(/\.[^.]+$/, '') // 移除扩展名
      .split(/[-_.]/)
      .filter(w => w.length > 3)
  }

  /**
   * 🎯 分类复活类型
   */
  private classifyResurrection(
    similarity: number,
    keywordMatch: { score: number }
  ): ResurrectionType {
    if (similarity > 0.9) {
      return ResurrectionType.CLONE
    } else if (similarity > 0.75) {
      return ResurrectionType.REFACTOR
    } else if (similarity > 0.6) {
      return ResurrectionType.MODULARIZE
    } else if (keywordMatch.score > 0.7) {
      return ResurrectionType.AI_DERIVED
    } else {
      return ResurrectionType.INSPIRED
    }
  }

  /**
   * 📈 计算置信度
   */
  private calculateConfidence(
    similarity: number,
    keywordMatch: { score: number }
  ): number {
    return (similarity * 0.7 + keywordMatch.score * 0.3)
  }

  /**
   * 📊 生成摘要
   */
  private generateSummary(zombies: ZombieCase[]): ScanSummary {
    const summary = {
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      totalResurrections: zombies.length
    }

    for (const zombie of zombies) {
      if (zombie.confidence >= 0.7) {
        summary.highConfidence++
      } else if (zombie.confidence >= 0.5) {
        summary.mediumConfidence++
      } else {
        summary.lowConfidence++
      }
    }

    return summary
  }

  /**
   * 📺 显示结果
   */
  private displayResults(zombies: ZombieCase[], summary: ScanSummary): void {
    console.log('🧟 诈尸检测报告')
    console.log('═' .repeat(60))
    console.log(`📊 扫描摘要:`)
    console.log(`   高置信度: ${summary.highConfidence}`)
    console.log(`   中置信度: ${summary.mediumConfidence}`)
    console.log(`   低置信度: ${summary.lowConfidence}`)
    console.log(`   总计: ${summary.totalResurrections}`)
    console.log('')

    if (zombies.length === 0) {
      console.log('✅ 未发现诈尸现象')
      console.log('💡 你的代码都是原创的！')
      return
    }

    console.log(`⚠️ 发现 ${zombies.length} 个诈尸案例:\n`)

    zombies.forEach((z, i) => {
      console.log(`${i + 1}. 🧟 ${z.corpsePath} → ${z.zombiePath}`)
      console.log(`   相似度: ${(z.similarity * 100).toFixed(1)}%`)
      console.log(`   置信度: ${(z.confidence * 100).toFixed(1)}%`)
      console.log(`   复活类型: ${this.getResurrectionLabel(z.resurrectionType)}`)
      console.log('')
    })
  }

  /**
   * 🏷️ 获取复活类型标签
   */
  private getResurrectionLabel(type: ResurrectionType): string {
    const labels = {
      [ResurrectionType.CLONE]: '🔄 完全克隆',
      [ResurrectionType.REFACTOR]: '🔨 重构改进',
      [ResurrectionType.MODULARIZE]: '📦 模块化提取',
      [ResurrectionType.AI_DERIVED]: '🧠 AI 派生',
      [ResurrectionType.INSPIRED]: '💡 灵感参考'
    }
    return labels[type] || '未知'
  }

  /**
   * 📝 生成诈尸报告
   */
  generateReport(result: ScanResult): string {
    let report = `
# 🧟 诈尸检测报告

**扫描时间**: ${result.timestamp}
**扫描仓库**: ${result.zombies[0]?.zombieRepo || 'N/A'}
**扫描文件数**: ${result.scanned}
**发现诈尸**: ${result.zombies.length} 具

---

## 📊 扫描摘要

- 🔴 高置信度: ${result.summary.highConfidence}
- 🟡 中置信度: ${result.summary.mediumConfidence}
- 🟢 低置信度: ${result.summary.lowConfidence}
- 📊 总计: ${result.summary.totalResurrections}

---

`

    if (result.zombies.length > 0) {
      report += `## 🎉 诈尸名单\n\n`

      result.zombies.forEach((z, i) => {
        report += `
### ${i + 1}. 🧟 诈尸案例

**墓地地址**: \`${z.corpseRepo}/${z.corpsePath}\`
**复活地点**: \`${z.zombieRepo}/${z.zombiePath}\`
**相似度**: ${(z.similarity * 100).toFixed(1)}%
**置信度**: ${(z.confidence * 100).toFixed(1)}%
**复活类型**: ${this.getResurrectionLabel(z.resurrectionType)}

`
      })
    } else {
      report += `
✅ **未发现诈尸现象**

墓地很安静，你的代码都是原创的！

`
    }

    report += `
---

> 💀 代码不是死了，只是去度了个假

---

*Generated by Enhanced Zombie Detector 🧟*
`

    return report
  }

  // ========== 工具方法 ==========

  private isCodeFile(filename: string): boolean {
    const extensions = ['.ts', '.js', '.py', '.go', '.rs', '.java', '.cpp', '.c']
    return extensions.some(ext => filename.endsWith(ext))
  }

  private async fetchFileContent(repo: string, path: string): Promise<string> {
    if (!this.octokit) return ''

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo,
        path
      })

      if (!Array.isArray(data) && 'content' in data) {
        return Buffer.from(data.content, 'base64').toString('utf-8')
      }
    } catch (error) {
      // Ignore
    }

    return ''
  }

  private tokenize(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  }

  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex')
  }

  private getMockFiles(repo: string): any[] {
    return [
      {
        path: 'src/utils/regex.ts',
        name: 'regex.ts',
        content: 'export function validateRegex(str: string) { ... }',
        hash: ''
      },
      {
        path: 'lib/auth/index.ts',
        name: 'index.ts',
        content: 'export class AuthManager { ... }',
        hash: ''
      }
    ]
  }

  private getBuiltinCemeteryData(): any[] {
    return [
      {
        repo: 'old-project',
        path: 'src/utils/regex.ts',
        content: 'export function validateRegex(str: string) { ... }',
        keywords: ['regex', 'validator']
      },
      {
        repo: 'legacy-app',
        path: 'src/auth.ts',
        content: 'export class AuthManager { ... }',
        keywords: ['auth']
      },
      {
        repo: 'deprecated',
        path: 'lib/logger.ts',
        content: 'export const logger = { ... }',
        keywords: ['logger']
      }
    ]
  }
}

// ========== CLI 入口 ==========

const args = process.argv.slice(2)
const command = args[0]

async function cliMain() {
  const config: DetectionConfig = {
    owner: 'your-username',
    similarityThreshold: 0.5,
    enableAI: false,
    enableGitHistory: false
  }

  const detector = new EnhancedZombieDetector(config)

  switch (command) {
    case 'scan':
      const repo = args[1]
      if (!repo) {
        console.log('用法: enhanced-zombie scan <repo-name>')
        return
      }

      const result = await detector.scanRepository(repo)
      const report = detector.generateReport(result)

      console.log(report)

      // 保存报告
      fs.writeFileSync('./enhanced-zombie-report.md', report)
      console.log('📄 报告已保存: enhanced-zombie-report.md')
      break

    case 'help':
    default:
      console.log(`
🧟 Enhanced Zombie Detector

用法:
  scan <repo-name>    扫描仓库检测诈尸
  help               显示帮助

示例:
  enhanced-zombie scan my-new-project
      `)
  }
}

// 只在直接运行时执行 CLI
if (require.main === module) {
  cliMain().catch(console.error)
}

