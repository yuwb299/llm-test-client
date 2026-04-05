import React, { useMemo } from 'react'
import { formatTokenCount, estimateCost } from '@/services/token-counter'
import { ChatMessage, ContentPart } from '@/types/message'
import { useProviderStore } from '@/store/providerStore'

interface TokenCounterProps {
  messages: ChatMessage[]
}

export const TokenCounter: React.FC<TokenCounterProps> = ({ messages }) => {
  const provider = useProviderStore((s) => s.getActiveProvider())
  const model = useProviderStore((s) => s.getActiveModel())

  const stats = useMemo(() => {
    let totalInput = 0
    let totalOutput = 0
    let totalMessages = messages.length

    for (const msg of messages) {
      if (msg.usage) {
        totalInput += msg.usage.promptTokens
        totalOutput += msg.usage.completionTokens
      }
    }

    const cost = model?.pricing
      ? estimateCost(totalInput, totalOutput, model.pricing.inputPerMillion, model.pricing.outputPerMillion)
      : null

    return { totalInput, totalOutput, totalMessages, cost }
  }, [messages, model])

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-surface-800 bg-surface-950 text-xs text-surface-500">
      <div className="flex gap-4">
        <span>Messages: {stats.totalMessages}</span>
        <span>Input: {formatTokenCount(stats.totalInput)}</span>
        <span>Output: {formatTokenCount(stats.totalOutput)}</span>
      </div>
      {stats.cost && (
        <span>
          Cost: ${stats.cost.totalCost.toFixed(6)}
          {provider && ` (${provider.name})`}
        </span>
      )}
    </div>
  )
}
