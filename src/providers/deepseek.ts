import { BaseProvider } from './base'
import { ProviderConfig, ChatCompletionParams } from '@/types/provider'
import { OpenAIProvider } from './openai'

export class DeepSeekProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }
}

export class OllamaProvider extends OpenAIProvider {
  // Default max tokens for local models - much higher than cloud APIs
  private static readonly DEFAULT_MAX_TOKENS = 8192
  private static readonly MAX_SUPPORTED_TOKENS = 32768

  constructor(config: ProviderConfig) {
    super(config)
  }

  private getMaxTokens(params: ChatCompletionParams): number | undefined {
    // If maxTokens is explicitly set and reasonable, use it
    if (params.maxTokens && params.maxTokens > 0) {
      // Cap at maximum supported to avoid issues
      return Math.min(params.maxTokens, OllamaProvider.MAX_SUPPORTED_TOKENS)
    }
    // Otherwise use default for local models
    return OllamaProvider.DEFAULT_MAX_TOKENS
  }

  override async complete(params: ChatCompletionParams) {
    const savedKey = this.config.apiKey
    this.config.apiKey = 'ollama'
    try {
      // Call parent with modified params
      const modifiedParams = {
        ...params,
        maxTokens: this.getMaxTokens(params),
      }
      return await super.complete(modifiedParams)
    } finally {
      this.config.apiKey = savedKey
    }
  }

  override async *stream(params: ChatCompletionParams) {
    const savedKey = this.config.apiKey
    this.config.apiKey = 'ollama'
    try {
      // Call parent with modified params
      const modifiedParams = {
        ...params,
        maxTokens: this.getMaxTokens(params),
      }
      yield* super.stream(modifiedParams)
    } finally {
      this.config.apiKey = savedKey
    }
  }
}

export { BaseProvider }
