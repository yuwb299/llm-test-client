import React, { useCallback, useState } from 'react'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { TokenCounter } from '@/components/TokenCounter/TokenCounter'
import { ExportDialog } from '@/components/Export/ExportDialog'
import { useChatStore } from '@/store/chatStore'
import { useProviderStore } from '@/store/providerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { providerRegistry } from '@/providers'
import { skillRegistry } from '@/skills'
import { ChatMessage, ContentPart } from '@/types/message'
import { generateId } from '@/utils/helpers'
import { Download, ChevronDown, Server } from 'lucide-react'

export const ChatPanel: React.FC = () => {
  const {
    getActiveConversation,
    addMessage,
    appendToLastAssistantMessage,
    updateLastAssistantMessage,
    createConversation,
    isStreaming,
    setStreaming,
    setAbortController,
  } = useChatStore()
  const { activeProviderId, activeModelId } = useProviderStore()
  const settings = useSettingsStore((s) => s.settings)
  const [showExport, setShowExport] = useState(false)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)

  const conversation = getActiveConversation()

  const handleSend = useCallback(
    async (content: string | ContentPart[], skillId?: string) => {
      let convId = conversation?.id
      if (!convId) {
        convId = createConversation(activeModelId, activeProviderId)
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      addMessage(convId, userMsg)

      const conv = useChatStore.getState().conversations.find((c) => c.id === convId)
      if (!conv) return

      let messages = conv.messages
      if (settings.maxContextMessages > 0 && messages.length > settings.maxContextMessages) {
        messages = messages.slice(-settings.maxContextMessages)
      }

      let systemPrompt = conv.systemPrompt
      let processedContent = content

      if (skillId) {
        const textContent = typeof content === 'string' ? content : ''
        const result = skillRegistry.applySkill(skillId, textContent)
        if (result) {
          systemPrompt = result.systemPrompt
          processedContent = result.processedMessage as string | ContentPart[]
        }
      }

      const provider = providerRegistry.get(conv.provider)

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: conv.model,
        provider: conv.provider,
      }
      addMessage(convId, assistantMsg)

      if (!provider) {
        updateLastAssistantMessage(
          convId!,
          '**Error:** Provider not registered. Please check that the provider is properly configured and enabled in settings.'
        )
        return
      }

      setStreaming(true)
      const controller = new AbortController()
      setAbortController(controller)

      try {
        if (settings.streamEnabled) {
          const stream = provider.stream({
            model: conv.model,
            messages: [...messages, userMsg],
            temperature: settings.temperature,
            topP: settings.topP,
            maxTokens: settings.maxTokens,
            stream: true,
            systemPrompt,
            signal: controller.signal,
          })

          let fullContent = ''
          let finalUsage: ChatMessage['usage']
          let pendingChunk = ''
          let rafId: number | null = null

          const flushPending = () => {
            if (pendingChunk) {
              appendToLastAssistantMessage(convId!, pendingChunk)
              pendingChunk = ''
            }
            rafId = null
          }

          for await (const chunk of stream) {
            if (controller.signal.aborted) break
            if (chunk.content) {
              fullContent += chunk.content
              pendingChunk += chunk.content
              if (!rafId) {
                rafId = requestAnimationFrame(flushPending)
              }
            }
            if (chunk.usage) {
              finalUsage = chunk.usage
            }
            if (chunk.done) break
          }

          if (rafId) cancelAnimationFrame(rafId)
          flushPending()

          updateLastAssistantMessage(convId!, fullContent, finalUsage)
        } else {
          const response = await provider.complete({
            model: conv.model,
            messages: [...messages, userMsg],
            temperature: settings.temperature,
            topP: settings.topP,
            maxTokens: settings.maxTokens,
            stream: false,
            systemPrompt,
            signal: controller.signal,
          })

          updateLastAssistantMessage(convId!, response.content, response.usage)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          updateLastAssistantMessage(convId!, '')
        } else {
          const errMsg = error instanceof Error ? error.message : 'Unknown error'
          updateLastAssistantMessage(convId!, `**Error:** ${errMsg}`)
        }
      } finally {
        setStreaming(false)
        setAbortController(null)
      }
    },
    [conversation, activeModelId, activeProviderId, settings, addMessage, appendToLastAssistantMessage, updateLastAssistantMessage, createConversation, setStreaming, setAbortController]
  )

  return (
    <div className="flex-1 flex flex-col h-full">
      {conversation && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700 bg-surface-900">
          <div className="relative">
            <button
              onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
              className="flex items-center gap-1.5 text-sm text-surface-300 hover:text-surface-100 transition-colors"
            >
              <span className="font-medium">{conversation.model}</span>
              <ChevronDown size={14} />
            </button>
            {modelSelectorOpen && (
              <ModelSelector
                selectedModel={conversation.model}
                selectedProvider={conversation.provider}
                onSelect={(providerId, modelId) => {
                  useProviderStore.getState().setActiveProvider(providerId)
                  useProviderStore.getState().setActiveModel(modelId)
                  const convs = useChatStore.getState().conversations
                  useChatStore.setState({
                    conversations: convs.map((c) =>
                      c.id === conversation.id ? { ...c, model: modelId, provider: providerId, updatedAt: Date.now() } : c
                    ),
                  })
                  useChatStore.getState().persist()
                  setModelSelectorOpen(false)
                }}
                onClose={() => setModelSelectorOpen(false)}
              />
            )}
          </div>
          <button
            onClick={() => setShowExport(true)}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
            title="Export"
          >
            <Download size={16} />
          </button>
        </div>
      )}

      <MessageList messages={conversation?.messages || []} isStreaming={isStreaming} />

      {settings.showTokenCount && conversation && (
        <TokenCounter messages={conversation.messages} />
      )}

      <InputArea onSend={handleSend} />

      {showExport && conversation && (
        <ExportDialog
          conversation={conversation}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}

interface ModelSelectorProps {
  selectedModel: string
  selectedProvider: string
  onSelect: (providerId: string, modelId: string) => void
  onClose: () => void
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, selectedProvider, onSelect, onClose }) => {
  const providers = useProviderStore((s) => s.providers)
  const enabled = providers.filter(p => p.enabled)
  const local = enabled.filter(p => p.isLocal)
  const remote = enabled.filter(p => !p.isLocal)
  const sorted = [...local, ...remote]

  return (
    <div className="absolute top-full left-0 mt-1 w-80 max-h-96 overflow-y-auto bg-surface-800 border border-surface-700 rounded-lg shadow-2xl z-50">
      {sorted.map((provider) => (
        <div key={provider.id}>
          <div className="px-3 py-2 text-xs font-semibold text-surface-500 bg-surface-850 sticky top-0 flex items-center gap-1.5">
            {provider.isLocal && <Server size={11} className="text-emerald-400" />}
            {provider.name}
            {provider.isLocal && <span className="text-emerald-400 ml-1">· 本地</span>}
          </div>
          {provider.models.map((model) => (
            <button
              key={model.id}
              onClick={() => onSelect(provider.id, model.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 flex items-center justify-between transition-colors ${
                selectedProvider === provider.id && selectedModel === model.id
                  ? 'bg-surface-700 text-primary-300'
                  : 'text-surface-300'
              }`}
            >
              <div>
                <div>{model.name}</div>
                <div className="text-xs text-surface-500 flex gap-2">
                  <span>{(model.maxTokens / 1000).toFixed(0)}K ctx</span>
                  {model.supportsVision && <span>👁</span>}
                  {model.pricing && <span>${model.pricing.inputPerMillion}/${model.pricing.outputPerMillion}/M</span>}
                  {provider.isLocal && !model.pricing && <span className="text-emerald-500">免费</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
