export type InteractionLogStatus = 'success' | 'error' | 'aborted'
export type InteractionLogType = 'complete' | 'stream'

export interface MessageLogEntry {
  role: string
  contentLength: number
  contentPreview: string
}

export interface RequestLog {
  messageCount: number
  messages: MessageLogEntry[]
  temperature?: number
  topP?: number
  maxTokens?: number
  hasSystemPrompt: boolean
  systemPromptPreview?: string
}

export interface ResponseLog {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  finishReason?: string
  durationMs: number
  ttfbMs?: number
}

export interface InteractionLog {
  id: string
  timestamp: number
  type: InteractionLogType
  providerId: string
  providerName: string
  providerType: string
  model: string
  request: RequestLog
  response: ResponseLog | null
  status: InteractionLogStatus
  error?: string
}
