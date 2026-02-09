/**
 * 🪦 Cemetery Capability Interface - 墓地能力接口
 * 
 * Universal interface that ANY AI agent can use:
 * - Claude (via MCP)
 * - GPT-4 (via OpenAI Functions)
 * - OpenClaw (via CLI)
 * - Local models (via REST API)
 * 
 * This is the contract that all adapters must implement.
 */

import { AssetType, AssetSource, AssetMetadata } from '../asset-index'
import { Tombstone } from '../tombstone-registry'

// ========== Analysis Results ==========

export interface AnalysisResult {
  isDead: boolean
  confidence: number
  reasons: string[]
  suggestions: string[]
  lastActivity?: string
  metrics: {
    daysSinceUpdate: number
    linesOfCode: number
    complexity: number
    dependencies: number
  }
}

export interface ZombieResult {
  isZombie: boolean
  similarity: number
  originalId?: string
  resurrectionType: 'clone' | 'refactor' | 'inspiration' | 'copy-paste'
  confidence: number
  matchedSegments: string[]
}

// ========== Asset Filters ==========

export interface AssetFilter {
  query?: string
  type?: AssetType
  source?: AssetSource
  language?: string
  tags?: string[]
  alive?: boolean
  limit?: number
  offset?: number
}

// ========== Search Results ==========

export interface SearchResult {
  type: 'asset' | 'tombstone'
  data: AssetMetadata | Tombstone
  score: number
  highlights: string[]
}

// ========== Cemetery Summary ==========

export interface CemeterySummary {
  generatedAt: string
  assets: {
    total: number
    alive: number
    dead: number
    byType: Record<string, number>
    byLanguage: Record<string, number>
  }
  tombstones: {
    total: number
    resurrected: number
    stillDead: number
    recentDeaths: Tombstone[]
  }
  trends: {
    newThisWeek: number
    diedThisMonth: number
    resurrectedThisMonth: number
    avgLifespan: number
  }
  topKillers: { cause: string; count: number }[]
}

// ========== Cemetery Capability Interface ==========

export interface CemeteryCapability {
  // ========== Core Analysis ==========
  
  /**
   * Analyze if code is "dead" (no activity for a long time)
   */
  analyzeCode(path: string): Promise<AnalysisResult>
  
  /**
   * Analyze code content directly
   */
  analyzeCodeContent(content: string, filePath?: string): Promise<AnalysisResult>
  
  // ========== Tombstone Management ==========
  
  /**
   * Generate tombstone for dead code
   */
  createTombstone(path: string, cause: string, options?: {
    epitaph?: string
    tags?: string[]
    summary?: string
  }): Promise<Tombstone>
  
  /**
   * Mark a tombstone as resurrected
   */
  resurrectTombstone(id: string, newLocation: string): Promise<Tombstone | null>
  
  // ========== Zombie Detection ==========
  
  /**
   * Detect if new code is a "zombie" (resurrected from dead code)
   */
  detectZombie(newCode: string, options?: {
    threshold?: number
  }): Promise<ZombieResult>
  
  /**
   * Compare new code against cemetery to find matches
   */
  findZombieMatches(newCode: string, limit?: number): Promise<ZombieResult[]>
  
  // ========== Asset Management ==========
  
  /**
   * Get all assets in cemetery
   */
  listAssets(filter?: AssetFilter): Promise<AssetMetadata[]>
  
  /**
   * Get a single asset by ID or path
   */
  getAsset(idOrPath: string): Promise<AssetMetadata | null>
  
  /**
   * Index a directory or file
   */
  indexPath(path: string): Promise<{ added: number; skipped: number; total: number }>
  
  // ========== Search ==========
  
  /**
   * Search cemetery for assets and tombstones
   */
  search(query: string, options?: {
    types?: ('asset' | 'tombstone')[]
    limit?: number
  }): Promise<SearchResult[]>
  
  // ========== Dashboard/Summary ==========
  
  /**
   * Get dashboard summary
   */
  getSummary(): Promise<CemeterySummary>
  
  /**
   * Generate quick digest for notifications
   */
  getDigest(): Promise<CemeterySummary>
}

// ========== Adapter Metadata ==========

export interface AdapterInfo {
  name: string
  version: string
  protocol: 'mcp' | 'openai' | 'rest' | 'cli'
  description: string
  capabilities: string[]
  endpoints?: {
    baseUrl?: string
    health?: string
    apiPath?: string
  }
}

// ========== Factory Function Type ==========

export type CemeteryFactory = (config?: CemeteryConfig) => CemeteryCapability

export interface CemeteryConfig {
  basePath?: string
  cacheDir?: string
  strictMode?: boolean
  defaultLimit?: number
}

// ========== Adapter Implementation Signatures ==========

export interface MCPAdapter extends CemeteryCapability {
  startServer(port?: number): Promise<void>
  stopServer(): void
}

export interface OpenAIAdapter extends CemeteryCapability {
  getFunctionDefinitions(): object[]
  callFunction(name: string, args: Record<string, any>): Promise<any>
}

export interface RESTAdapter extends CemeteryCapability {
  startServer(port?: number, host?: string): Promise<void>
  stopServer(): void
  getBaseUrl(): string
}

export interface CLIAdapter extends CemeteryCapability {
  execute(args: string[]): Promise<string>
  getHelp(): string
}
