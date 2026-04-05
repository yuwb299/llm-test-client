export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export type ContentType = 'text' | 'image' | 'image_url' | 'audio' | 'file'

export interface ContentPart {
  type: ContentType
  text?: string
  imageUrl?: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
  imageData?: {
    data: string
    mimeType: string
  }
  audioData?: {
    data: string
    mimeType: string
  }
  fileData?: {
    data: string
    mimeType: string
    filename: string
  }
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string | ContentPart[]
  timestamp: number
  model?: string
  provider?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  toolCallId?: string
  metadata?: Record<string, unknown>
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  model: string
  provider: string
  systemPrompt?: string
  tags?: string[]
}

export interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  data: string
  preview?: string
}
