import {
  ChatCompletionParams,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
} from '@/types/provider'
import { ChatMessage } from '@/types/message'

export abstract class BaseProvider {
  protected config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  abstract complete(params: ChatCompletionParams): Promise<ChatCompletionResponse>
  abstract stream(params: ChatCompletionParams): AsyncGenerator<StreamChunk>
  abstract countTokens(text: string): Promise<number>

  get id() {
    return this.config.id
  }
  get name() {
    return this.config.name
  }
  get models() {
    return this.config.models
  }

  protected buildMessages(messages: ChatMessage[], systemPrompt?: string) {
    const result: Array<{ role: string; content: unknown }> = []

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt })
    }

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content })
      } else {
        const parts = msg.content.map((part) => {
          if (part.type === 'text') return { type: 'text', text: part.text }
          if (part.type === 'image_url' && part.imageUrl) {
            return { type: 'image_url', image_url: { url: part.imageUrl.url, detail: part.imageUrl.detail || 'auto' } }
          }
          if (part.type === 'image' && part.imageData) {
            return {
              type: 'image_url',
              image_url: { url: `data:${part.imageData.mimeType};base64,${part.imageData.data}` },
            }
          }
          return { type: 'text', text: '' }
        })
        result.push({ role: msg.role, content: parts })
      }
    }
    return result
  }

  updateConfig(config: Partial<ProviderConfig>) {
    Object.assign(this.config, config)
  }
}
