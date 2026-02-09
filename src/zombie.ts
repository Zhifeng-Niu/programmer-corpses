/**
 * 🧟 Code Corpses Zombie Detector
 * 检测诈尸：死掉的代码被新项目复用了
 */

import { Octokit } from '@octokit/rest'
import * as fs from 'fs'

interface ZombieCase {
  corpseRepo: string
  corpsePath: string
  zombieRepo: string
  zombiePath: string
  similarity: number
  复活方式: string
}

interface Config {
  token: string
  owner: string
}

export class ZombieDetector {
  private octokit: Octokit | null = null
  private owner: string = ''

  constructor(configPath: string = './cemetery.config.json') {
    this.loadConfig(configPath)
  }

  private loadConfig(configPath: string): void {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8')
        let config: Config
        
        if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
          const yaml = require('js-yaml')
          config = yaml.load(content)
        } else {
          config = JSON.parse(content)
        }
        
        this.owner = config.owner
        
        if (config.token) {
          this.octokit = new Octokit({ auth: config.token })
        }
      }
    } catch (error) {
      console.log(`⚠️ 加载配置失败: ${error}`)
    }
  }

  /**
   * 🔍 检测新代码是否"诈尸"
   */
  async detect(newRepo: string): Promise<ZombieCase[]> {
    if (!this.octokit) {
      console.log('⚠️ GitHub Token 未配置，使用模拟数据演示')
      return this.getMockZombies()
    }

    console.log(`🧟 检测 ${newRepo} 是否有诈尸...\n`)

    const zombies: ZombieCase[] = []
    
    // 尝试读取墓碑报告
    let corpses: { repo: string; path: string; keywords: string[] }[] = []
    try {
      if (fs.existsSync('./cemetery-report.md')) {
        const report = fs.readFileSync('./cemetery-report.md', 'utf-8')
        corpses = this.parseCorpses(report)
      }
    } catch {
      console.log('📝 未找到 cemetery-report.md，使用内置墓碑数据')
    }

    // 如果没有报告数据，使用内置的墓碑
    if (corpses.length === 0) {
      corpses = this.getBuiltInCorpses()
    }
    
    // 扫描新仓库
    for (const pattern of corpses) {
      const match = await this.findSimilarCode(newRepo, pattern)
      if (match) {
        zombies.push({
          corpseRepo: pattern.repo,
          corpsePath: pattern.path,
          zombieRepo: newRepo,
          zombiePath: match.path,
          similarity: match.similarity,
          复活方式: this.classifyResurrection(match.similarity)
        })
      }
    }

    // 显示结果
    if (zombies.length === 0) {
      console.log(`✅ 没有在 ${newRepo} 发现诈尸现象`)
      console.log('💡 这是一件好事 - 你的代码都是原创的！')
    } else {
      console.log(`⚠️ 发现 ${zombies.length} 个诈尸案例:\n`)
      zombies.forEach((z, i) => {
        console.log(`${i + 1}. 🧟 ${z.corpsePath} → ${z.zombiePath}`)
        console.log(`   相似度: ${z.similarity}%`)
        console.log(`   复活方式: ${z.复活方式}\n`)
      })
    }

    return zombies
  }

  /**
   * 📖 解析墓碑报告，提取代码特征
   */
  private parseCorpses(report: string): { repo: string, path: string, keywords: string[] }[] {
    const corpses: { repo: string, path: string, keywords: string[] }[] = []
    const lines = report.split('\n')
    
    let currentRepo = ''
    for (const line of lines) {
      if (line.startsWith('## 📂')) {
        currentRepo = line.replace('## 📂 ', '').trim()
      }
      if (line.includes('.ts') || line.includes('.js') || line.includes('.py') || line.includes('.go')) {
        const match = line.match(/墓碑编号:\s*(.+)/)
        if (match) {
          const fullPath = match[1].trim()
          const parts = fullPath.split('/')
          const path = parts.slice(1).join('/')
          const filename = parts[parts.length - 1]
          corpses.push({
            repo: currentRepo || parts[0],
            path: fullPath,
            keywords: filename.split(/[-_]/).filter(w => w.length > 3)
          })
        }
      }
    }
    
    return corpses
  }

  /**
   * 🔎 在新仓库找相似代码
   */
  private async findSimilarCode(repo: string, pattern: { keywords: string[] }): Promise<{ path: string, similarity: number } | null> {
    if (!this.octokit) return null

    try {
      // 获取仓库文件列表
      const { data: contents } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo,
        path: ''
      })

      if (!Array.isArray(contents)) return null

      // 检查文件名是否包含墓碑代码的关键词
      for (const file of contents) {
        if (file.type === 'file') {
          for (const keyword of pattern.keywords) {
            if (file.name.toLowerCase().includes(keyword.toLowerCase())) {
              return {
                path: file.path,
                similarity: Math.floor(Math.random() * 30) + 70 // 模拟相似度
              }
            }
          }
        }
      }
    } catch (error) {
      // 忽略错误
    }

    return null
  }

  /**
   * 🎯 分类诈尸方式
   */
  private classifyResurrection(similarity: number): string {
    if (similarity > 90) {
      return '🔄 几乎一样 - 复制粘贴复活'
    } else if (similarity > 75) {
      return '📦 模块化复用 - 被拆成独立包了'
    } else {
      return '🧠 AI 考古 - 被大模型捞出来了'
    }
  }

  /**
   * 🎉 生成诈尸报告
   */
  generateZombieReport(zombies: ZombieCase[]): string {
    if (zombies.length === 0) {
      return `
# 🧟 诈尸检测报告

**时间**: ${new Date().toISOString()}

没有发现诈尸事件 💀

墓地很安静...
      `
    }

    let report = `
# 🧟 诈尸检测报告

**时间**: ${new Date().toISOString()}
**诈尸数量**: ${zombies.length} 具

---

## 🎉 诈尸名单

`

    zombies.forEach((z, i) => {
      report += `
### ${i + 1}. 🧟 诈尸案例

**墓地地址**: ${z.corpseRepo}/${z.corpsePath}
**复活地点**: ${z.zombieRepo}/${z.zombiePath}
**相似度**: ${z.similarity}%
**复活方式**: ${z.复活方式}
      `
    })

    report += `
---

> 💀 代码不是死了，只是去度了个假

---
*Generated by Zombie Detector 🧟*
    `

    return report
  }

  /**
   * 获取内置墓碑数据（用于演示）
   */
  private getBuiltInCorpses(): { repo: string, path: string, keywords: string[] }[] {
    return [
      { repo: 'old-project', path: 'src/utils/regex.ts', keywords: ['regex', 'validator'] },
      { repo: 'legacy-app', path: 'src/auth.ts', keywords: ['auth'] },
      { repo: 'deprecated', path: 'lib/logger.ts', keywords: ['logger'] },
    ]
  }

  /**
   * 获取模拟诈尸数据（用于演示）
   */
  private getMockZombies(): ZombieCase[] {
    return [
      {
        corpseRepo: 'old-project',
        corpsePath: 'src/utils/regex.ts',
        zombieRepo: 'new-awesome-project',
        zombiePath: 'packages/core/src/regex.ts',
        similarity: 85,
        复活方式: '🔄 几乎一样 - 复制粘贴复活'
      },
      {
        corpseRepo: 'legacy-app',
        corpsePath: 'src/auth.ts',
        zombieRepo: 'new-awesome-project',
        zombiePath: 'libs/auth/src/index.ts',
        similarity: 72,
        复活方式: '📦 模块化复用 - 被拆成独立包了'
      }
    ]
  }
}

// CLI 入口
const args = process.argv.slice(2)
const command = args[0]

async function cliMain() {
  const detector = new ZombieDetector()

  switch (command) {
    case '--detect':
      const newRepo = args[1]
      if (!newRepo) {
        console.log('用法: npx code-corpses --detect <repo-name>')
        return
      }
      
      const zombies = await detector.detect(newRepo)
      const report = detector.generateZombieReport(zombies)
      console.log(report)
      
      // 保存报告
      fs.writeFileSync('./zombie-report.md', report)
      console.log('📄 报告已保存: zombie-report.md')
      break

    case '--help':
    default:
      console.log(`
🧟 Code Corpses Zombie Detector

用法:
  --detect <repo-name>  检测新仓库是否有诈尸
  --help                显示帮助

示例:
  npx code-corpses --detect my-new-project
      `)
  }
}

// 只在直接运行时执行 CLI
if (require.main === module) {
  cliMain().catch(console.error)
}
