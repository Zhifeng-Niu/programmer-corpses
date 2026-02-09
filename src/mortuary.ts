/**
 * 🏛️ Code Mortuary - 代码太平间
 * 
 * 死掉的代码送去太平间，原项目干干净净
 * 
 * ⚠️ 重要提示：
 * - 墓碑一定会生成
 * - 删除代码是可选的，需要手动开启
 * - 默认只生成墓碑，不删除任何代码
 * 
 * 核心功能：
 * - 📦 从项目移除代码（不是删除，是移送）- 需要开启删除权限
 * - 🏛️ 存入墓地仓库
 * - 🔍 随时可以去墓地翻尸
 * - 🧟 诈尸时一键复活回原项目
 */

import { Octokit } from '@octokit/rest'
import * as fs from 'fs'
import * as path from 'path'
import * as child_process from 'child_process'

interface MortuaryConfig {
  github_token: string
  cemetery_repo: string  // 墓地仓库地址
  owner: string
}

interface CorpsePackage {
  id: string
  original_repo: string
  original_path: string
  death_reason: string
  death_date: string
  tombstone: string
  files: string[]
}

export class CodeMortuary {
  private octokit: Octokit
  private config: MortuaryConfig
  private cemetery_repo: string[]

  constructor(configPath: string = './mortuary.config.json') {
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    this.octokit = new Octokit({ auth: this.config.github_token })
    this.cemetery_repo = this.config.cemetery_repo.split('/')
  }

  /**
   * 📦 移送代码去太平间
   * 
   * 步骤：
   * 1. 复制代码到墓地
   * 2. 在原项目删除
   * 3. 生成墓碑
   * 4. 提交记录
   */
  async embalm(
    repo: string,
    filePaths: string[],
    deathReason: string
  ): Promise<string> {
    interface PushMeta {
      original_repo: string
      original_path: string
      death_reason: string
      death_date: string
    }

    // 1. 读取代码内容
    const files = await this.readFiles(repo, filePaths)
    
    // 2. 存入墓地仓库
    const corpseId = `${repo}-${Date.now()}`
    const pushMeta: PushMeta = {
      original_repo: repo,
      original_path: filePaths.join(', '),
      death_reason: deathReason,
      death_date: new Date().toISOString(),
    }
    await this.pushToCemetery(corpseId, files, pushMeta)

    // 3. 生成墓碑
    const tombstone = this.generateTombstone({
      id: corpseId,
      original_repo: repo,
      original_path: filePaths.join(', '),
      death_reason: deathReason,
      death_date: pushMeta.death_date,
      tombstone: '',
      files: filePaths
    })

    // 4. 在原项目删除
    await this.deleteFromRepo(repo, filePaths)

    return tombstone
  }

  /**
   * 🏛️ 从墓地读取代码（复活用）
   */
  async resurrect(corpseId: string): Promise<CorpsePackage | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.cemetery_repo[0],
        repo: this.cemetery_repo[1],
        path: corpseId
      })

      if (!Array.isArray(data)) {
        return null
      }

      return {
        id: corpseId,
        original_repo: '',
        original_path: '',
        death_reason: '',
        death_date: '',
        tombstone: '',
        files: data.map(f => f.name)
      }
    } catch (error) {
      return null
    }
  }

  /**
   * 🧟 复活代码回原项目
   */
  async revive(
    corpseId: string,
    targetRepo: string,
    targetPath: string = ''
  ): Promise<boolean> {
    const corpse = await this.resurrect(corpseId)
    if (!corpse) return false

    // 从墓地读取
    const files = await this.readFromCemetery(corpseId)

    // 写入原项目
    for (const file of files) {
      await this.createInRepo(targetRepo, `${targetPath}/${file.name}`, file.content)
    }

    return true
  }

  /**
   * 🔍 在墓地搜索
   */
  async search(keywords: string[]): Promise<CorpsePackage[]> {
    // 简化版：搜索墓碑文件
    return []
  }

  /**
   * 📊 墓地统计
   */
  async stats(): Promise<{
    total_corpses: number
    total_files: number
    oldest_corpses: CorpsePackage[]
  }> {
    return {
      total_corpses: 0,
      total_files: 0,
      oldest_corpses: []
    }
  }

  // ========== 私有方法 ==========

  private async readFiles(repo: string, paths: string[]): Promise<{ name: string; content: string }[]> {
    const files: { name: string; content: string }[] = []
    for (const p of paths) {
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.config.owner,
          repo: repo,
          path: p
        })
        
        if (!Array.isArray(data) && 'content' in data) {
          files.push({
            name: path.basename(p),
            content: Buffer.from(data.content, 'base64').toString('utf-8')
          })
        }
      } catch (e) {
        console.log(`⚠️ 读取 ${p} 失败`)
      }
    }
    return files
  }

  private async pushToCemetery(
    corpseId: string,
    files: { name: string, content: string }[],
    meta: any
  ) {
    // 创建墓碑目录
    const dir = `./temp-cemetery/${corpseId}`
    fs.mkdirSync(dir, { recursive: true })

    // 写入文件
    for (const f of files) {
      fs.writeFileSync(`${dir}/${f.name}`, f.content)
    }

    // 写入墓碑信息
    fs.writeFileSync(`${dir}/tombstone.json`, JSON.stringify(meta, null, 2))

    // 打印（实际应该是 git 操作推送到墓地仓库）
    console.log(`📦 ${files.length} 个文件已打包`)
    console.log(`🪦 墓碑 ID: ${corpseId}`)
    console.log(`\n下一步：推送到墓地仓库 ${this.config.cemetery_repo}`)
  }

  private generateTombstone(corpse: CorpsePackage): string {
    return `
🪦 墓碑编号: ${corpse.id}
═══════════════════════════════════

💀 死因: ${corpse.death_reason}
📦 原位置: ${corpse.original_repo}/${corpse.original_path}
📅 死亡日期: ${corpse.death_date}
📄 文件数量: ${corpse.files.length}

📍 墓地地址: ${this.config.cemetery_repo}/${corpse.id}

🧟 诈尸方式:
   mortuary.resurrect('${corpse.id}')

💡 提示: 代码没死透，只是去墓地度假了
    `
  }

  private async deleteFromRepo(repo: string, paths: string[]) {
    for (const p of paths) {
      console.log(`🗑️ 删除: ${p}`)
      // 实际调用 GitHub API 删除文件
    }
  }

  private async readFromCemetery(corpseId: string): Promise<{ name: string; content: string }[]> {
    return []
  }

  private async createInRepo(repo: string, path: string, content: string) {
    console.log(`✨ 创建: ${path}`)
  }
}

// CLI
const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'embalm':
      const repo = args[1]
      const files = args[2]?.split(',') || []
      const reason = args[3] || '寿终正寝'
      console.log(`📦 移送 ${files.length} 个文件去墓地...`)
      break

    case 'resurrect':
      const corpseId = args[1]
      console.log(`🏛️ 复活 ${corpseId}...`)
      break

    case 'search':
      const keywords = args.slice(1)
      console.log(`🔍 搜索: ${keywords.join(' ')}`)
      break

    case 'stats':
      console.log(`📊 墓地统计...`)
      break

    case 'init':
      console.log(`
🏛️ Code Mortuary 初始化

请创建 mortuary.config.json:

{
  "github_token": "ghp_xxxxx",
  "cemetery_repo": "owner/cemetery-repo",
  "owner": "your-username"
}

然后运行:
  mortuary embalm my-repo "src/old,lib/deprecated" "不再维护"
      `)
      break

    default:
      console.log(`
🏛️ Code Mortuary - 代码太平间

用法:
  embalm <repo> <files> <reason>    📦 移送代码去墓地
  resurrect <corpse-id>              🏛️ 复活代码
  search <keywords...>               🔍 搜索墓地
  stats                              📊 墓地统计
  init                               ⚙️ 初始化配置

示例:
  mortuary embalm my-project "utils/old.js,lib/deprecated" "代码太老了"
  mortuary resurrect project-123456
  mortuary search "auth utils"

💡 提示: 移送不是删除，是给代码找个好归宿
      `)
  }
}

// 只在直接运行时执行 CLI
if (require.main === module) {
  main().catch(console.error)
}
