type Encoder = { encode: (text: string) => number[] }

let encoderPromise: Promise<Encoder> | null = null

function getEncoder(): Promise<Encoder> {
  if (encoderPromise) return encoderPromise
  encoderPromise = import('js-tiktoken')
    .then(({ getEncoding }) => getEncoding('o200k_base'))
    .catch(() => ({
      encode: (text: string) => {
        const charCount = text.length
        const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length
        return new Array(Math.ceil(charCount / 3.5 + cjkCount * 0.5))
      },
    }))
  return encoderPromise
}

export async function countTokens(text: string): Promise<number> {
  const enc = await getEncoder()
  return enc.encode(text).length
}

export async function countMessageTokens(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>
): Promise<number> {
  let total = 0
  for (const msg of messages) {
    total += 4
    if (typeof msg.content === 'string') {
      total += await countTokens(msg.content)
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.text) total += await countTokens(part.text)
        if (part.type === 'image_url' || part.type === 'image') total += 85
      }
    }
    total += await countTokens(msg.role)
  }
  return total + 2
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  inputPerMillion: number,
  outputPerMillion: number
): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCost = (inputTokens / 1_000_000) * inputPerMillion
  const outputCost = (outputTokens / 1_000_000) * outputPerMillion
  return { inputCost, outputCost, totalCost: inputCost + outputCost }
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}
