import { BaseProvider } from './base'
import { ChatCompletionParams, ChatCompletionResponse, StreamChunk, ProviderConfig } from '@/types/provider'

export class OpenAIProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  async complete(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const messages = this.buildMessages(params.messages, params.systemPrompt)
    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      temperature: params.temperature ?? 0.7,
      top_p: params.topP ?? 1,
      max_tokens: params.maxTokens ?? 4096,
      stream: false,
    }
    if (params.jsonMode) {
      body.response_format = { type: 'json_object' }
    }
    if (params.tools?.length) {
      body.tools = params.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.inputSchema },
      }))
    }
    if (params.stop?.length) {
      body.stop = params.stop
    }

    const res = await fetch(`${this.config.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.customHeaders,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err.error?.message || `API Error: ${res.status}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]

    return {
      id: data.id,
      content: choice?.message?.content || '',
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      finishReason: choice?.finish_reason || 'stop',
      toolCalls: choice?.message?.tool_calls,
    }
  }

  async *stream(params: ChatCompletionParams): AsyncGenerator<StreamChunk> {
    const messages = this.buildMessages(params.messages, params.systemPrompt)
    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      temperature: params.temperature ?? 0.7,
      top_p: params.topP ?? 1,
      max_tokens: params.maxTokens ?? 4096,
      stream: true,
    }
    if (params.jsonMode) {
      body.response_format = { type: 'json_object' }
    }

    const res = await fetch(`${this.config.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.customHeaders,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err.error?.message || `API Error: ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let id = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') {
          if (trimmed === 'data: [DONE]') {
            yield { id, content: '', done: true }
          }
          continue
        }
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          id = json.id || id
          const delta = json.choices?.[0]?.delta

          yield {
            id,
            content: delta?.content || '',
            done: false,
            finishReason: json.choices?.[0]?.finish_reason,
            usage: json.usage
              ? {
                  promptTokens: json.usage.prompt_tokens ?? 0,
                  completionTokens: json.usage.completion_tokens ?? 0,
                  totalTokens: json.usage.total_tokens ?? 0,
                }
              : undefined,
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    try {
      const { getEncoding } = await import('js-tiktoken')
      const enc = getEncoding('o200k_base')
      return enc.encode(text).length
    } catch {
      return Math.ceil(text.length / 3.5)
    }
  }
}
