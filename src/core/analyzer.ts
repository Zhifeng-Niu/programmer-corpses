/**
 * 🧠 AI Code Analyzer - AI 代码分析器
 * 
 * Analyzes code to determine if it's "dead" based on various metrics:
 * - Time since last update
 * - Complexity metrics
 * - Dependency status
 * - Code patterns
 */

import * as fs from 'fs'
import * as path from 'path'
import { loadIndex, AssetMetadata, AssetType } from '../asset-index'
import { listTombstones, loadRegistry, Tombstone } from '../tombstone-registry'
import { AnalysisResult } from './interfaces'

// ========== Configuration ==========

const DEFAULT_DEATH_THRESHOLD_DAYS = 90
const COMPLEXITY_THRESHOLD = 100
const MAX_DEPENDENCIES = 50

// ========== Analysis Utilities ==========

interface FileMetrics {
  linesOfCode: number
  complexity: number
  functions: number
  classes: number
  comments: number
  imports: number
  exports: number
}

function analyzeFileMetrics(content: string): FileMetrics {
  const lines = content.split('\n')
  const linesOfCode = lines.length
  
  // Count functions
  const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/g) || []).length
  const arrowFunctions = (content.match(/const\s+\w+\s*=\s*[^=]*=>/g) || []).length
  
  // Count classes
  const classes = (content.match(/class\s+\w+/g) || []).length
  
  // Count comments
  const singleLineComments = (content.match(/\/\/.*$/gm) || []).length
  const multiLineComments = (content.match(/\/\*[\s\S]*?\*\//g) || []).length
  const comments = singleLineComments + multiLineComments
  
  // Count imports/exports
  const imports = (content.match(/import\s+.*?from/g) || []).length
  const exports = (content.match(/export\s+(default\s+)?(class|function|const|interface|type)/g) || []).length
  
  // Simple complexity: nested structures + conditions
  const nestedCount = (content.match(/\{[\s\S]*?\{[\s\S]*?\}/g) || []).length
  const ifCount = (content.match(/if\s*\(/g) || []).length
  const switchCount = (content.match(/switch\s*\(/g) || []).length
  const complexity = nestedCount + ifCount + switchCount + 1
  
  return {
    linesOfCode,
    complexity,
    functions: functions + arrowFunctions,
    classes,
    comments,
    imports,
    exports
  }
}

function calculateDaysSinceUpdate(filePath: string): number {
  try {
    const stats = fs.statSync(filePath)
    const mtime = stats.mtime
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - mtime.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  } catch {
    return 365 // Default to 1 year if can't read
  }
}

function checkDependencyStatus(filePath: string): {
  outdated: boolean
  unused: boolean
  missing: string[]
} {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    
    // Check for package.json patterns
    const packageJsonPath = path.join(path.dirname(filePath), 'package.json')
    let depsStatus = { outdated: false, unused: false, missing: [] as string[] }
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        
        if (Object.keys(deps).length > MAX_DEPENDENCIES) {
          depsStatus.outdated = true
        }
        
        // Check for unused deps (simple heuristic)
        const importedDeps = content.match(/require\(['"]([^'"]+)['"]\)|import.*?from\s+['"]([^'"]+)['"]/g) || []
        const usedDeps = new Set(importedDeps.map(m => {
          const match = m.match(/['"]([^'"]+)['"]/)
          return match ? match[1].split('/')[0] : null
        }).filter(Boolean))
        
        const allDeps = new Set(Object.keys(deps))
        const unused = [...allDeps].filter(d => !usedDeps.has(d))
        
        if (unused.length > Object.keys(deps).length * 0.5) {
          depsStatus.unused = true
        }
      } catch {
        // Ignore package.json parse errors
      }
    }
    
    return depsStatus
  } catch {
    return { outdated: false, unused: false, missing: [] }
  }
}

// ========== Dead Code Detection ==========

function detectDeathReasons(metrics: FileMetrics, daysSinceUpdate: number, filePath: string): {
  reasons: string[]
  suggestions: string[]
} {
  const reasons: string[] = []
  const suggestions: string[] = []
  
  // Time-based death
  if (daysSinceUpdate > 365) {
    reasons.push('超过1年无任何更新')
    suggestions.push('考虑归档或彻底删除')
  } else if (daysSinceUpdate > 180) {
    reasons.push('超过6个月无更新')
    suggestions.push('评估是否仍在维护')
  } else if (daysSinceUpdate > 90) {
    reasons.push('超过90天无更新')
    suggestions.push('检查是否有未处理的技术债务')
  }
  
  // Complexity death
  if (metrics.complexity > COMPLEXITY_THRESHOLD * 2) {
    reasons.push('代码复杂度极高')
    suggestions.push('建议重构为更小的模块')
  }
  
  // Import/export issues
  if (metrics.exports > 0 && metrics.imports === 0) {
    reasons.push('有导出但无引入（可能是孤岛代码）')
    suggestions.push('检查是否仍被使用')
  }
  
  if (metrics.imports > 0 && metrics.exports === 0) {
    reasons.push('纯工具文件且无导出')
    suggestions.push('考虑合并到调用处')
  }
  
  // Check dependencies
  const depsStatus = checkDependencyStatus(filePath)
  if (depsStatus.outdated) {
    reasons.push('依赖数量过多，可能存在废弃依赖')
    suggestions.push('运行 npm audit 或依赖清理')
  }
  if (depsStatus.unused) {
    reasons.push('可能存在未使用的依赖')
    suggestions.push('运行 dependency cruiser 分析')
  }
  
  // Comment ratio (too many comments might indicate dead documentation)
  const commentRatio = metrics.comments / metrics.linesOfCode
  if (commentRatio > 0.5 && metrics.linesOfCode > 100) {
    reasons.push('注释比例过高，可能是废弃的文档')
    suggestions.push('检查是否需要保留')
  }
  
  // Empty or nearly empty file
  if (metrics.linesOfCode < 5) {
    reasons.push('文件几乎为空')
    suggestions.push('直接删除或合并到其他文件')
  }
  
  return { reasons, suggestions }
}

// ========== Main Analyzer ==========

export class CodeAnalyzer {
  private deathThresholdDays: number
  private basePath: string
  
  constructor(options?: {
    deathThresholdDays?: number
    basePath?: string
  }) {
    this.deathThresholdDays = options?.deathThresholdDays ?? DEFAULT_DEATH_THRESHOLD_DAYS
    this.basePath = options?.basePath ?? process.cwd()
  }
  
  /**
   * Analyze a file to determine if it's dead
   */
  async analyzeCode(filePath: string): Promise<AnalysisResult> {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.basePath, filePath)
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      // Check if it's in the index
      const index = loadIndex(this.basePath)
      const asset = index.find(a => 
        a.location === filePath || 
        a.location.endsWith(filePath) ||
        a.id === filePath
      )
      
      if (asset) {
        return this.analyzeAsset(asset)
      }
      
      return {
        isDead: true,
        confidence: 1.0,
        reasons: ['文件不存在'],
        suggestions: ['从索引中移除'],
        metrics: {
          daysSinceUpdate: 365,
          linesOfCode: 0,
          complexity: 0,
          dependencies: 0
        }
      }
    }
    
    // Read file content
    let content: string
    try {
      content = fs.readFileSync(absolutePath, 'utf-8')
    } catch {
      return {
        isDead: false,
        confidence: 0,
        reasons: ['无法读取文件'],
        suggestions: ['检查文件权限'],
        metrics: {
          daysSinceUpdate: 0,
          linesOfCode: 0,
          complexity: 0,
          dependencies: 0
        }
      }
    }
    
    return this.analyzeContent(content, absolutePath)
  }
  
  /**
   * Analyze code content directly
   */
  async analyzeCodeContent(content: string, filePath?: string): Promise<AnalysisResult> {
    return this.analyzeContent(content, filePath || 'unknown')
  }
  
  private analyzeContent(content: string, filePath: string): AnalysisResult {
    const metrics = analyzeFileMetrics(content)
    const daysSinceUpdate = filePath && fs.existsSync(filePath) 
      ? calculateDaysSinceUpdate(filePath) 
      : 0
    
    const { reasons, suggestions } = detectDeathReasons(metrics, daysSinceUpdate, filePath)
    
    // Calculate death confidence
    let confidence = 0
    if (daysSinceUpdate > this.deathThresholdDays * 2) {
      confidence = 0.95
    } else if (daysSinceUpdate > this.deathThresholdDays) {
      confidence = 0.8
    } else if (reasons.length > 0) {
      confidence = Math.min(0.3 + reasons.length * 0.15, 0.7)
    }
    
    // Check if already in tombstone registry
    const registry = loadRegistry(this.basePath)
    const existingTombstone = registry.find(t => 
      t.originalPath === filePath || 
      (filePath && t.originalPath.endsWith(path.basename(filePath)))
    )
    
    if (existingTombstone) {
      confidence = 1.0
      reasons.push('已存在于墓碑注册处')
    }
    
    return {
      isDead: confidence > 0.6,
      confidence,
      reasons,
      suggestions,
      lastActivity: daysSinceUpdate > 0 
        ? `${daysSinceUpdate}天前` 
        : undefined,
      metrics: {
        daysSinceUpdate,
        linesOfCode: metrics.linesOfCode,
        complexity: metrics.complexity,
        dependencies: metrics.imports
      }
    }
  }
  
  private analyzeAsset(asset: AssetMetadata): AnalysisResult {
    const daysSinceUpdate = asset.updatedAt 
      ? Math.floor((Date.now() - new Date(asset.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 365
    
    const reasons: string[] = []
    const suggestions: string[] = []
    
    if (!asset.alive) {
      return {
        isDead: true,
        confidence: 1.0,
        reasons: ['资产已标记为死亡'],
        suggestions: ['查看墓碑获取详情'],
        metrics: {
          daysSinceUpdate,
          linesOfCode: asset.lineCount,
          complexity: 0,
          dependencies: 0
        }
      }
    }
    
    if (daysSinceUpdate > this.deathThresholdDays) {
      reasons.push(`超过${this.deathThresholdDays}天无更新`)
      suggestions.push('评估是否仍在维护')
    }
    
    return {
      isDead: reasons.length > 0,
      confidence: reasons.length > 0 ? 0.8 : 0,
      reasons,
      suggestions,
      lastActivity: `${daysSinceUpdate}天前`,
      metrics: {
        daysSinceUpdate,
        linesOfCode: asset.lineCount,
        complexity: 0,
        dependencies: 0
      }
    }
  }
  
  /**
   * Batch analyze multiple files
   */
  async analyzeMultiple(filePaths: string[]): Promise<Map<string, AnalysisResult>> {
    const results = new Map<string, AnalysisResult>()
    
    for (const filePath of filePaths) {
      const result = await this.analyzeCode(filePath)
      results.set(filePath, result)
    }
    
    return results
  }
  
  /**
   * Find dead code in a directory
   */
  async findDeadCode(dirPath: string, thresholdDays?: number): Promise<{
    dead: string[]
    alive: string[]
    uncertain: string[]
  }> {
    const index = loadIndex(this.basePath)
    const threshold = thresholdDays || this.deathThresholdDays
    const now = Date.now()
    
    const dead: string[] = []
    const alive: string[] = []
    const uncertain: string[] = []
    
    for (const asset of index) {
      const daysSinceUpdate = asset.updatedAt
        ? Math.floor((now - new Date(asset.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 365
      
      if (daysSinceUpdate > threshold * 2) {
        dead.push(asset.location)
      } else if (daysSinceUpdate < threshold / 2) {
        alive.push(asset.location)
      } else {
        uncertain.push(asset.location)
      }
    }
    
    return { dead, alive, uncertain }
  }
}

// ========== CLI Entry ==========

if (require.main === module) {
  const args = process.argv.slice(2)
  const command = args[0]
  
  async function main() {
    const analyzer = new CodeAnalyzer()
    
    switch (command) {
      case 'analyze': {
        const filePath = args[1]
        if (!filePath) {
          console.log('用法: analyzer analyze <path>')
          return
        }
        
        console.log(`\n🔍 分析 ${filePath}...\n`)
        const result = await analyzer.analyzeCode(filePath)
        
        console.log(`状态: ${result.isDead ? '💀 死亡' : '🟢 存活'}`)
        console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`)
        
        if (result.reasons.length > 0) {
          console.log(`\n死因:`)
          result.reasons.forEach(r => console.log(`  - ${r}`))
        }
        
        if (result.suggestions.length > 0) {
          console.log(`\n建议:`)
          result.suggestions.forEach(s => console.log(`  - ${s}`))
        }
        
        console.log(`\n指标:`)
        console.log(`  - 最后更新: ${result.metrics.daysSinceUpdate} 天前`)
        console.log(`  - 代码行数: ${result.metrics.linesOfCode}`)
        console.log(`  - 复杂度: ${result.metrics.complexity}`)
        break
      }
      
      case 'find': {
        const dirPath = args[1] || '.'
        const threshold = parseInt(args[2]) || 90
        
        console.log(`\n🕵️ 在 ${dirPath} 中查找死代码 (阈值: ${threshold}天)...\n`)
        
        const result = await analyzer.findDeadCode(dirPath, threshold)
        
        console.log(`💀 死亡: ${result.dead.length}`)
        console.log(`🟢 存活: ${result.alive.length}`)
        console.log(`❓ 不确定: ${result.uncertain.length}`)
        
        if (result.dead.length > 0) {
          console.log(`\n需要关注的死亡文件:`)
          result.dead.slice(0, 10).forEach(f => console.log(`  - ${f}`))
          if (result.dead.length > 10) {
            console.log(`  ... 还有 ${result.dead.length - 10} 个`)
          }
        }
        break
      }
      
      default:
        console.log(`
🧠 Code Analyzer - 代码分析器

用法:
  analyze <path>    分析单个文件
  find <dir> [days]  查找死代码

示例:
  analyzer analyze ./src/old-module.ts
  analyzer find ./src 90
        `)
    }
  }
  
  main().catch(console.error)
}
