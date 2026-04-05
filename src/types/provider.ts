export interface ProviderConfig {
  id: string
  name: string
  type: ProviderType
  apiBaseUrl: string
  apiKey: string
  models: ModelInfo[]
  enabled: boolean
  customHeaders?: Record<string, string>
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'ollama' | 'custom'

export interface ModelInfo {
  id: string
  name: string
  maxTokens: number
  supportsVision: boolean
  supportsAudio: boolean
  supportsStreaming: boolean
  supportsToolUse: boolean
  supportsJsonMode: boolean
  pricing?: {
    inputPerMillion: number
    outputPerMillion: number
  }
}

import { ChatMessage } from './message'
import { MCPServerTool } from './mcp'

export interface ChatCompletionParams {
  model: string
  messages: ChatMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
  stop?: string[]
  tools?: MCPServerTool[]
  jsonMode?: boolean
  systemPrompt?: string
}

export interface ChatCompletionResponse {
  id: string
  content: string
  model: string
  usage: TokenUsage
  finishReason: string
  toolCalls?: ToolCall[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface StreamChunk {
  id: string
  content?: string
  done: boolean
  usage?: TokenUsage
  toolCalls?: ToolCall[]
  finishReason?: string
}

export type ProviderError = {
  code: string
  message: string
  statusCode?: number
}
