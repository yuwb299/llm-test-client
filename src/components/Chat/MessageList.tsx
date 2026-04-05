import React, { useRef, useEffect, useCallback } from 'react'
import { ChatMessage } from '@/types/message'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isStreaming }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const checkBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const threshold = 80
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom(false)
    }
  }, [messages, isStreaming, scrollToBottom])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">🤖</div>
          <h2 className="text-xl font-semibold text-surface-300">LLM Test Client</h2>
          <p className="text-sm text-surface-500 max-w-md">
            多模型 · 多模态 · Token计量 · Markdown渲染 · Skill插件 · MCP协议
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-surface-600">
            {['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Ollama'].map((p) => (
              <span key={p} className="px-2 py-1 bg-surface-800 rounded">{p}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onScroll={checkBottom}
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-surface-500">Generating...</span>
        </div>
      )}
    </div>
  )
}
