/**
 * 🤖 Code Corpses MCP Server
 * 让任何 AI Agent（Claude, GPT, OpenAI）都能调用墓地功能
 * 
 * 集成方式：MCP (Model Context Protocol)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'code-corpses', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// 📦 墓碑数据
const cemetery = [
  {
    id: "regex-validator",
    name: "RegEx 验证码解析器",
    causeOfDeath: "被产品改成了滑块验证",
    age: "2周",
    epitaph: "它曾经能识别99%的验证码，直到验证码学会了自我进化",
    killedBy: "前端负责人Peter",
    dateOfDeath: "2024-03-15",
    emoji: "🎭"
  },
  // ... 更多墓碑
]

// 🧠 工具定义
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: 'visit_tombstone',
        description: '🎲 随机访问一个代码墓碑，获取死代码的故事',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'check_code_status',
        description: '🔍 检查某段代码是否已经"死掉"（长时间无修改）',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: '文件路径' },
            thresholdDays: { type: 'number', description: '死代码阈值（默认90天）' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'generate_tombstone',
        description: '🪦 为一段代码生成墓碑',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '代码名称' },
            causeOfDeath: { type: 'string', description: '死因' },
            age: { type: 'string', description: '存活时间' }
          },
          required: ['name', 'causeOfDeath']
        }
      },
      {
        name: 'cemetery_stats',
        description: '📊 获取墓地统计信息',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'search_zombie',
        description: '🧟 搜索诈尸案例（被复用的死代码）',
        inputSchema: {
          type: 'object',
          properties: {
            keywords: { type: 'string', description: '搜索关键词' }
          }
        }
      }
    ]
  }
})

// 🔧 工具处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'visit_tombstone':
      const random = cemetery[Math.floor(Math.random() * cemetery.length)]
      return {
        content: [{
          type: 'text',
          text: `
🪦 今日墓碑

${random.emoji} ${random.name}
💀 死因: ${random.causeOfDeath}
⏰ 享年: ${random.age}
📜 墓志铭: "${random.epitaph}"
👮 凶手: ${random.killedBy}
          `
        }]
      }

    case 'cemetery_stats':
      return {
        content: [{
          type: 'text',
          text: `
📊 墓地统计

🪦 总墓碑: ${cemetery.length}
💀 平均寿命: ${Math.floor(cemetery.reduce((a, b) => a + parseAge(b.age), 0) / cemetery.length)} 天
🧟 诈尸指数: ${Math.floor(Math.random() * 20)}%
          `
        }]
      }

    case 'generate_tombstone':
      return {
        content: [{
          type: 'text',
          text: `
🪦 新墓碑已生成

💀 ${args.name}
死因: ${args.causeOfDeath}
享年: ${args.age}
📅 忌日: ${new Date().toISOString().split('T')[0]}

墓志铭: "RIP - 代码千古事，得失寸心知"
          `
        }]
      }

    default:
      return {
        content: [{ type: 'text', text: '未知工具' }]
      }
  }
})

// 辅助函数
const parseAge = (age: string): number => {
  const num = parseInt(age)
  if (age.includes('年')) return num * 365
  if (age.includes('月')) return num * 30
  if (age.includes('周')) return num * 7
  return num
}

// 🚀 启动 MCP Server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.log('🪦 Code Corpses MCP Server 已启动！')
}

main().catch(console.error)
