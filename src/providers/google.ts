import { BaseProvider } from './base'
import { ChatCompletionParams, ChatCompletionResponse, StreamChunk, ProviderConfig } from '@/types/provider'
import { ChatMessage } from '@/types/message'

export class GoogleProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config)
  }

  private convertMessages(messages: ChatMessage[], systemPrompt?: string) {
    const contents: Array<{ role: string; parts: unknown[] }> = []

    for (const msg of messages) {
      if (msg.role === 'system') continue
      const role = msg.role === 'assistant' ? 'model' : 'user'
      if (typeof msg.content === 'string') {
        contents.push({ role, parts: [{ text: msg.content }] })
      } else {
        const parts = msg.content.map((part) => {
          if (part.type === 'text') return { text: part.text }
          if (part.type === 'image' && part.imageData) {
            return { inlineData: { mimeType: part.imageData.mimeType, data: part.imageData.data } }
          }
          return { text: '' }
        })
        contents.push({ role, parts })
      }
    }

    return { contents, systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined }
  }

  async complete(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const { contents, systemInstruction } = this.convertMessages(params.messages, params.systemPrompt)

    const generationConfig: Record<string, unknown> = {
      temperature: params.temperature ?? 0.7,
      topP: params.topP ?? 1,
      maxOutputTokens: params.maxTokens ?? 4096,
    }
    if (params.jsonMode) {
      generationConfig.responseMimeType = 'application/json'
    }
    const body: Record<string, unknown> = { contents, generationConfig }
    if (systemInstruction) body.systemInstruction = systemInstruction

    const url = `${this.config.apiBaseUrl}/models/${params.model}:generateContent?key=${this.config.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.customHeaders },
      body: JSON.stringify(body),
      signal: params.signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err.error?.message || `API Error: ${res.status}`)
    }

    const data = await res.json()
    const candidate = data.candidates?.[0]
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text)

    return {
      id: `gemini-${Date.now()}`,
      content: textPart?.text || '',
      model: params.model,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: candidate?.finishReason || 'stop',
    }
  }

  async *stream(params: ChatCompletionParams): AsyncGenerator<StreamChunk> {
    const { contents, systemInstruction } = this.convertMessages(params.messages, params.systemPrompt)

    const generationConfig: Record<string, unknown> = {
      temperature: params.temperature ?? 0.7,
      topP: params.topP ?? 1,
      maxOutputTokens: params.maxTokens ?? 4096,
    }
    const body: Record<string, unknown> = { contents, generationConfig }
    if (systemInstruction) body.systemInstruction = systemInstruction

    const url = `${this.config.apiBaseUrl}/models/${params.model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.config.customHeaders },
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
          const candidate = json.candidates?.[0]
          const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text)

          yield {
            id: `gemini-${Date.now()}`,
            content: textPart?.text || '',
            done: candidate?.finishReason === 'STOP',
            finishReason: candidate?.finishReason,
            usage: json.usageMetadata
              ? {
                  promptTokens: json.usageMetadata.promptTokenCount ?? 0,
                  completionTokens: json.usageMetadata.candidatesTokenCount ?? 0,
                  totalTokens: json.usageMetadata.totalTokenCount ?? 0,
                }
              : undefined,
          }
        } catch {
          // skip
        }
      }
    }

    yield { id: '', content: '', done: true }
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 3.5)
  }
}
