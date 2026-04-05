import { BaseProvider } from './base'
import { ChatCompletionParams, ChatCompletionResponse, StreamChunk, ProviderConfig } from '@/types/provider'
import { ChatMessage } from '@/types/message'

export class AnthropicProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  private convertMessages(messages: ChatMessage[], systemPrompt?: string) {
    const system = systemPrompt || ''
    const converted: Array<{ role: string; content: unknown }> = []

    for (const msg of messages) {
      if (msg.role === 'system') continue
      if (typeof msg.content === 'string') {
        converted.push({ role: msg.role, content: msg.content })
      } else {
        const parts = msg.content
          .filter((p) => p.type === 'text' || p.type === 'image' || p.type === 'image_url')
          .map((part) => {
            if (part.type === 'text') return { type: 'text' as const, text: part.text || '' }
            const imgData = part.imageData || (part.imageUrl ? null : null)
            if (imgData) {
              return {
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: imgData.mimeType, data: imgData.data },
              }
            }
            return { type: 'text' as const, text: '' }
          })
        converted.push({ role: msg.role, content: parts })
      }
    }

    return { system, messages: converted }
  }

  async complete(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const { system, messages } = this.convertMessages(params.messages, params.systemPrompt)

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.7,
      top_p: params.topP ?? 1,
    }
    if (system) body.system = system
    if (params.tools?.length) {
      body.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }))
    }

    const res = await fetch(`${this.config.apiBaseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        ...this.config.customHeaders,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err.error?.message || `API Error: ${res.status}`)
    }

    const data = await res.json()
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')

    return {
      id: data.id,
      content: textBlock?.text || '',
      model: data.model,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      finishReason: data.stop_reason || 'stop',
      toolCalls: data.content
        ?.filter((b: { type: string }) => b.type === 'tool_use')
        .map((b: { id: string; name: string; input: string }) => ({
          id: b.id,
          type: 'function' as const,
          function: { name: b.name, arguments: JSON.stringify(b.input) },
        })),
    }
  }

  async *stream(params: ChatCompletionParams): AsyncGenerator<StreamChunk> {
    const { system, messages } = this.convertMessages(params.messages, params.systemPrompt)

    const body: Record<string, unknown> = {
      model: params.model,
      messages,
      max_tokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 0.7,
      stream: true,
    }
    if (system) body.system = system

    const res = await fetch(`${this.config.apiBaseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        ...this.config.customHeaders,
      },
      body: JSON.stringify(body),
      signal: params.signal,
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
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))

          if (json.type === 'message_start') {
            id = json.message?.id || ''
          } else if (json.type === 'content_block_delta') {
            const delta = json.delta
            if (delta?.type === 'text_delta') {
              yield { id, content: delta.text || '', done: false }
            }
          } else if (json.type === 'message_delta') {
            yield {
              id,
              content: '',
              done: true,
              finishReason: json.delta?.stop_reason,
              usage: json.usage
                ? {
                    promptTokens: json.usage.input_tokens ?? 0,
                    completionTokens: json.usage.output_tokens ?? 0,
                    totalTokens: (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0),
                  }
                : undefined,
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 3.5)
  }
}
