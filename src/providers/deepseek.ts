import { BaseProvider } from './base'
import { ProviderConfig } from '@/types/provider'
import { OpenAIProvider } from './openai'

export class DeepSeekProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }
}

export class OllamaProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  override async complete(params: import('@/types/provider').ChatCompletionParams) {
    const savedKey = this.config.apiKey
    this.config.apiKey = 'ollama'
    try {
      return await super.complete(params)
    } finally {
      this.config.apiKey = savedKey
    }
  }

  override async *stream(params: import('@/types/provider').ChatCompletionParams) {
    const savedKey = this.config.apiKey
    this.config.apiKey = 'ollama'
    try {
      yield* super.stream(params)
    } finally {
      this.config.apiKey = savedKey
    }
  }
}

export { BaseProvider }
