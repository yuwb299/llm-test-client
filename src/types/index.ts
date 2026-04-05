export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN' | 'en-US'
  defaultProvider: string
  defaultModel: string
  sendOnEnter: boolean
  showTokenCount: boolean
  showTimestamp: boolean
  fontSize: number
  maxContextMessages: number
  streamEnabled: boolean
  temperature: number
  topP: number
  maxTokens: number
}

export type ExportFormat = 'markdown' | 'html' | 'pdf' | 'json' | 'png'

export interface ExportOptions {
  format: ExportFormat
  includeMetadata: boolean
  includeTokenUsage: boolean
  includeTimestamps: boolean
  filename?: string
}
