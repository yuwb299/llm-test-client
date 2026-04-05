import { BaseProvider } from './base'
import {
  ChatCompletionParams,
  ChatCompletionResponse,
  StreamChunk,
  ProviderConfig,
  TokenUsage,
} from '@/types/provider'
import { InteractionLog } from '@/types/log'
import { useLogStore } from '@/store/logStore'
import { generateId } from '@/utils/helpers'

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + `... (${text.length} chars total)`
}

function buildRequestLog(params: ChatCompletionParams) {
  return {
    messageCount: params.messages.length,
    messages: params.messages.map((m) => ({
      role: m.role,
      contentLength:
        typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length,
      contentPreview:
        typeof m.content === 'string' ? truncateText(m.content, 200) : '[multipart content]',
    })),
    temperature: params.temperature,
    topP: params.topP,
    maxTokens: params.maxTokens,
    hasSystemPrompt: !!params.systemPrompt,
    systemPromptPreview: params.systemPrompt ? truncateText(params.systemPrompt, 200) : undefined,
  }
}

export class LoggingProvider extends BaseProvider {
  private inner: BaseProvider

  constructor(config: ProviderConfig, inner: BaseProvider) {
    super(config)
    this.inner = inner
  }

  async complete(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const startTime = Date.now()
    const requestLog = buildRequestLog(params)

    try {
      const response = await this.inner.complete(params)

      this.recordLog({
        id: generateId(),
        timestamp: startTime,
        type: 'complete',
        providerId: this.config.id,
        providerName: this.config.name,
        providerType: this.config.type,
        model: params.model,
        request: requestLog,
        response: {
          content: truncateText(response.content, 2000),
          usage: response.usage,
          finishReason: response.finishReason,
          durationMs: Date.now() - startTime,
        },
        status: 'success',
      })

      return response
    } catch (error) {
      this.recordLog({
        id: generateId(),
        timestamp: startTime,
        type: 'complete',
        providerId: this.config.id,
        providerName: this.config.name,
        providerType: this.config.type,
        model: params.model,
        request: requestLog,
        response: null,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async *stream(params: ChatCompletionParams): AsyncGenerator<StreamChunk> {
    const startTime = Date.now()
    const requestLog = buildRequestLog(params)
    let fullContent = ''
    let firstChunkTime: number | null = null
    let finalUsage: TokenUsage | undefined
    let streamDone = false
    let hadError = false
    let errorMsg = ''

    try {
      for await (const chunk of this.inner.stream(params)) {
        if (chunk.content) {
          if (firstChunkTime === null) firstChunkTime = Date.now()
          fullContent += chunk.content
        }
        if (chunk.usage) finalUsage = chunk.usage
        if (chunk.done) streamDone = true
        yield chunk
      }
    } catch (error) {
      hadError = true
      errorMsg = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      this.recordLog({
        id: generateId(),
        timestamp: startTime,
        type: 'stream',
        providerId: this.config.id,
        providerName: this.config.name,
        providerType: this.config.type,
        model: params.model,
        request: requestLog,
        response: {
          content: truncateText(fullContent, 2000),
          usage: finalUsage,
          durationMs: Date.now() - startTime,
          ttfbMs: firstChunkTime !== null ? firstChunkTime - startTime : undefined,
        },
        status: hadError ? 'error' : streamDone ? 'success' : 'aborted',
        error: hadError ? errorMsg : undefined,
      })
    }
  }

  async countTokens(text: string): Promise<number> {
    return this.inner.countTokens(text)
  }

  override updateConfig(config: Partial<ProviderConfig>) {
    this.inner.updateConfig(config)
    super.updateConfig(config)
  }

  private recordLog(log: InteractionLog) {
    try {
      useLogStore.getState().addLog(log)
    } catch {
      // silently ignore if store is unavailable
    }
  }
}
