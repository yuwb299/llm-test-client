import React from 'react'
import { Plus, Trash2, MessageSquare } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { useProviderStore } from '@/store/providerStore'
import { truncateText } from '@/utils/helpers'

interface SidebarProps {
  isOpen: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const { conversations, activeConversationId, createConversation, setActiveConversation, deleteConversation } = useChatStore()
  const { activeProviderId, activeModelId } = useProviderStore()

  if (!isOpen) return null

  return (
    <div className="w-64 h-full bg-surface-900 border-r border-surface-700 flex flex-col">
      <div className="p-3">
        <button
          onClick={() => createConversation(activeModelId, activeProviderId)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-sm text-surface-600">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors mb-0.5 ${
                activeConversationId === conv.id
                  ? 'bg-surface-800 text-surface-100'
                  : 'text-surface-400 hover:bg-surface-800/50 hover:text-surface-300'
              }`}
              onClick={() => setActiveConversation(conv.id)}
            >
              <MessageSquare size={14} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{truncateText(conv.title, 30)}</div>
                <div className="text-xs text-surface-600 flex gap-1.5">
                  <span>{conv.messages.length} msgs</span>
                  <span>·</span>
                  <span>{conv.model.split('/').pop()}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteConversation(conv.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-surface-700 text-xs text-surface-600 text-center">
        LLM Test Client v1.0
      </div>
    </div>
  )
}
