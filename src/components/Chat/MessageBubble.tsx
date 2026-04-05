import React, { useMemo } from 'react'
import { User, Bot, Wrench, Copy, Check } from 'lucide-react'
import { ChatMessage as ChatMessageType, ContentPart } from '@/types/message'
import { MarkdownRenderer } from '@/components/Markdown/MarkdownRenderer'
import { useSettingsStore } from '@/store/settingsStore'
import { formatTokenCount } from '@/services/token-counter'
import { useState } from 'react'

interface MessageBubbleProps {
  message: ChatMessageType
}

export const MessageBubble = React.memo(function MessageBubble({ message }: MessageBubbleProps) {
  const settings = useSettingsStore((s) => s.settings)
  const [copied, setCopied] = useState(false)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isSystem = message.role === 'system'

  const textContent = useMemo(() => {
    if (typeof message.content === 'string') return message.content
    return message.content
      .filter((p): p is ContentPart & { type: 'text' } => p.type === 'text')
      .map((p) => p.text || '')
      .join('\n')
  }, [message.content])

  const hasImages = useMemo(() => {
    if (typeof message.content === 'string') return false
    return message.content.some((p) => p.type === 'image' || p.type === 'image_url')
  }, [message.content])

  const images = useMemo(() => {
    if (typeof message.content === 'string') return []
    return message.content
      .filter((p) => p.type === 'image' && p.imageData)
      .map((p) => `data:${p.imageData!.mimeType};base64,${p.imageData!.data}`)
      .concat(
        message.content
          .filter((p) => p.type === 'image_url' && p.imageUrl)
          .map((p) => p.imageUrl!.url)
      )
  }, [message.content])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex gap-3 px-4 py-3 ${isUser ? 'bg-transparent' : isSystem ? 'bg-yellow-500/5' : 'bg-surface-900/50'}`}>
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        isUser ? 'bg-primary-600 text-white' : isSystem ? 'bg-yellow-600 text-white' : 'bg-surface-700 text-surface-300'
      }`}>
        {isUser ? <User size={16} /> : isSystem ? <Wrench size={16} /> : <Bot size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-surface-400">
            {isUser ? 'You' : isSystem ? 'System' : 'Assistant'}
          </span>
          {message.model && (
            <span className="text-xs text-surface-600 bg-surface-800 px-1.5 py-0.5 rounded">
              {message.model}
            </span>
          )}
          {settings.showTimestamp && (
            <span className="text-xs text-surface-600">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        {isUser ? (
          <div className="text-surface-200 whitespace-pre-wrap text-sm leading-relaxed">{textContent}</div>
        ) : (
          <div style={{ fontSize: `${settings.fontSize}px` }}>
            <MarkdownRenderer content={textContent} />
          </div>
        )}

        {hasImages && (
          <div className="flex flex-wrap gap-2 mt-2">
            {images.map((src, i) => (
              <img key={i} src={src} alt={`attachment-${i}`} className="max-w-xs max-h-48 rounded-lg border border-surface-700" />
            ))}
          </div>
        )}

        {(isAssistant || isSystem) && textContent && (
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handleCopy}
              className="text-surface-600 hover:text-surface-400 transition-colors"
              title="Copy"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            {settings.showTokenCount && message.usage && (
              <span className="text-xs text-surface-600">
                Tokens: {formatTokenCount(message.usage.totalTokens)}
                {message.usage.completionTokens > 0 && ` (${formatTokenCount(message.usage.promptTokens)}+${formatTokenCount(message.usage.completionTokens)})`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
