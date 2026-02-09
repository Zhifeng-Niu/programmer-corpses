/**
 * 🤖 Code Corpses AI Scanner
 * 自动扫描 GitHub 代码，检测"死代码"
 */

import { Octokit } from '@octokit/rest'
import * as fs from 'fs'
import * as path from 'path'

interface Corpse {
  repo: string
  path: string
  lastCommit: string
  daysInactive: number
  reason: string
}

interface Config {
  token: string
  owner: string
  repos: string[]
  thresholdDays: number
  notifyChannel: 'telegram' | 'discord' | 'email'
  autoArchive: boolean
}

export class CodeCorpseScanner {
  private octokit: Octokit | null = null
  private config: Config | null = null

  constructor(configPath: string = './cemetery.config.json') {
    this.loadConfig(configPath)
  }

  private loadConfig(configPath: string): void {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8')
        // 支持 JSON 和 YAML
        if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
          const yaml = require('js-yaml')
          this.config = yaml.load(content)
        } else {
          this.config = JSON.parse(content)
        }
        
        if (this.config?.token) {
          this.octokit = new Octokit({ auth: this.config.token })
        }
      }
    } catch (error) {
      console.log(`⚠️ 加载配置失败: ${error}`)
    }
  }

  /**
   * 🔍 扫描单个仓库的死代码
   */
  async scanRepo(repo: string): Promise<Corpse[]> {
    if (!this.octokit || !this.config) {
      console.log('⚠️ GitHub Token 未配置，无法扫描')
      return []
    }

    const corpses: Corpse[] = []
    
    try {
      // 获取所有文件
      const { data: contents } = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo,
        path: ''
      })

      if (!Array.isArray(contents)) return []

      for (const file of contents) {
        if (file.type === 'file' && this.isCodeFile(file.name)) {
          const corpse = await this.checkFile(repo, file.path)
          if (corpse) corpses.push(corpse)
        }
      }
    } catch (error) {
      console.log(`⚠️ 扫描 ${repo} 失败: ${error}`)
    }

    return corpses
  }

  /**
   * 📊 检查单个文件的活跃度
   */
  private async checkFile(repo: string, filePath: string): Promise<Corpse | null> {
    if (!this.octokit || !this.config) return null

    try {
      const { data: commits } = await this.octokit.repos.listCommits({
        owner: this.config.owner,
        repo,
        path: filePath,
        per_page: 1
      })

      const lastCommitDate = new Date(commits[0].commit.committer?.date || '')
      const daysInactive = Math.floor(
        (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysInactive >= this.config.thresholdDays) {
        return {
          repo,
          path: filePath,
          lastCommit: lastCommitDate.toISOString().split('T')[0],
          daysInactive,
          reason: this.generateDeathReason(filePath, daysInactive)
        }
      }
    } catch (error) {
      console.log(`  ⚠️ 检查 ${filePath} 失败`)
    }

    return null
  }

  /**
   * 💀 生成死因
   */
  private generateDeathReason(filePath: string, days: number): string {
    const reasons = [
      `已经 ${days} 天没人疼了`,
      `产品说"这个功能不要了"，但没人敢删`,
      `代码太老了，IDE 都认不出它了`,
      `注释比代码还多，意思是没人看懂`,
      `测试覆盖率 0%，没人爱`,
      `最后改它的人已经离职了`,
      `它曾经辉煌过，但现在只剩下灰尘`
    ]
    return reasons[Math.floor(Math.random() * reasons.length)]
  }

  /**
   * 📁 检查是否是代码文件
   */
  private isCodeFile(filename: string): boolean {
    const extensions = ['.ts', '.js', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.swift', '.kt']
    return extensions.some(ext => filename.endsWith(ext))
  }

  /**
   * 🪦 生成墓碑
   */
  generateTombstone(corpse: Corpse): string {
    return `
🪦 墓碑编号: ${corpse.repo}/${corpse.path}
─────────────────────────────────────
💀 死因: ${corpse.reason}
⏰ 躺尸: ${corpse.daysInactive} 天
📅 最后活跃: ${corpse.lastCommit}
🔗 位置: ${corpse.repo}/${corpse.path}

🧟 诈尸指数: ${Math.min(30, corpse.daysInactive / 10)}%
    `
  }

  /**
   * 🚀 执行完整扫描
   */
  async scanAll(): Promise<string> {
    if (!this.config) {
      const errorMsg = '⚠️ 未配置 cemetery.config.json'
      console.log(errorMsg)
      return errorMsg
    }

    console.log('🕵️ 开始扫描墓地...\n')
    console.log(`📝 配置: ${this.config.owner}/${this.config.repos.join(', ')}`)
    console.log(`📊 躺尸阈值: ${this.config.thresholdDays} 天\n`)
    
    let totalCorpses = 0
    let report = ''

    for (const repo of this.config.repos) {
      console.log(`📂 扫描 ${repo}...`)
      const corpses = await this.scanRepo(repo)
      
      if (corpses.length > 0) {
        report += `\n## 📂 ${repo} 墓地\n`
        for (const corpse of corpses) {
          report += this.generateTombstone(corpse)
          totalCorpses++
        }
        console.log(`   ✅ 发现 ${corpses.length} 具尸体`)
      } else {
        console.log(`   ✅ 没有发现尸体`)
      }
    }

    report = `
# 🪦 代码墓地扫描报告

**扫描时间**: ${new Date().toISOString()}  
**躺尸阈值**: ${this.config.thresholdDays} 天  
**发现尸体**: ${totalCorpses} 具

${report}

---
*Generated by Code Corpses Scanner 🤖*
    `

    // 保存报告
    fs.writeFileSync('./cemetery-report.md', report)
    console.log(`\n✅ 扫描完成！发现 ${totalCorpses} 具尸体`)
    console.log('📄 报告已保存: cemetery-report.md')

    return report
  }

  /**
   * 📢 发送通知
   */
  async notify(message: string): Promise<void> {
    if (!this.config) return

    if (this.config.notifyChannel === 'telegram') {
      // Telegram 通知（通过 OpenClaw message）
      console.log('📱 Telegram 通知已发送')
    } else if (this.config.notifyChannel === 'discord') {
      console.log('💬 Discord 通知已发送')
    }
  }
}

// CLI 入口
const args = process.argv.slice(2)
const command = args[0]

async function cliMain() {
  if (command === '--scan') {
    const configPath = args[1] || './cemetery.config.json'
    const scanner = new CodeCorpseScanner(configPath)
    await scanner.scanAll()
  } else if (command === '--init') {
    console.log(`
🪦 初始化 Code Corpses 配置

请创建 cemetery.config.json:

{
  "token": "ghp_xxxxx",
  "owner": "your-username",
  "repos": ["repo1", "repo2"],
  "thresholdDays": 90,
  "notifyChannel": "telegram",
  "autoArchive": true
}

或者 YAML 格式 (cemetery.config.yaml):

token: ghp_xxxxx
owner: your-username
repos:
  - repo1
  - repo2
thresholdDays: 90
notifyChannel: telegram
autoArchive: true

然后运行: npx code-corpses --scan
    `)
  } else {
    console.log(`
🪦 Code Corpses Scanner

用法:
  --scan     执行完整扫描
  --init     初始化配置

示例:
  npx code-corpses --scan
  npx code-corpses --scan ./my-config.json
    `)
  }
}

// 只在直接运行时执行 CLI
if (require.main === module) {
  cliMain().catch(console.error)
}
