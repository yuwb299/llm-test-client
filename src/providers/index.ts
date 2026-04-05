import { ProviderConfig } from '@/types/provider'
import { BaseProvider } from './base'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import { GoogleProvider } from './google'
import { DeepSeekProvider, OllamaProvider } from './deepseek'
import { LoggingProvider } from './logging'

const providerMap: Record<string, new (config: ProviderConfig) => BaseProvider> = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  google: GoogleProvider,
  deepseek: DeepSeekProvider,
  ollama: OllamaProvider,
}

class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map()

  register(config: ProviderConfig): BaseProvider {
    const Ctor = providerMap[config.type] || OpenAIProvider
    const provider = new Ctor(config)
    const wrapped = new LoggingProvider(config, provider)
    this.providers.set(config.id, wrapped)
    return wrapped
  }

  get(id: string): BaseProvider | undefined {
    return this.providers.get(id)
  }

  unregister(id: string) {
    this.providers.delete(id)
  }

  getAll(): BaseProvider[] {
    return Array.from(this.providers.values())
  }

  getAllEnabled(): BaseProvider[] {
    return this.getAll().filter((p) => (p as any).config?.enabled !== false)
  }
}

export const providerRegistry = new ProviderRegistry()
export { BaseProvider, OpenAIProvider, AnthropicProvider, GoogleProvider, DeepSeekProvider, OllamaProvider }
