import { create } from 'zustand'
import { Conversation, ChatMessage } from '@/types/message'
import { loadConversations, saveConversations } from '@/services/storage'
import { generateId } from '@/utils/helpers'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  isStreaming: boolean
  abortController: AbortController | null

  getActiveConversation: () => Conversation | undefined
  createConversation: (model: string, provider: string, systemPrompt?: string) => string
  deleteConversation: (id: string) => void
  setActiveConversation: (id: string | null) => void
  addMessage: (conversationId: string, message: ChatMessage) => void
  updateLastAssistantMessage: (conversationId: string, content: string, usage?: ChatMessage['usage']) => void
  appendToLastAssistantMessage: (conversationId: string, chunk: string) => void
  setStreaming: (streaming: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  updateConversationTitle: (id: string, title: string) => void
  clearConversations: () => void
  persist: () => void
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: loadConversations(),
  activeConversationId: null,
  isStreaming: false,
  abortController: null,

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get()
    return conversations.find((c) => c.id === activeConversationId)
  },

  createConversation: (model, provider, systemPrompt) => {
    const id = generateId()
    const conv: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model,
      provider,
      systemPrompt,
    }
    set((s) => ({
      conversations: [conv, ...s.conversations],
      activeConversationId: id,
    }))
    get().persist()
    return id
  },

  deleteConversation: (id) => {
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
    }))
    get().persist()
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== conversationId) return c
        const messages = [...c.messages, message]
        const title = c.messages.length === 0 && typeof message.content === 'string'
          ? message.content.slice(0, 40) || 'New Chat'
          : c.title
        return { ...c, messages, title, updatedAt: Date.now() }
      }),
    }))
    get().persist()
  },

  updateLastAssistantMessage: (conversationId, content, usage) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== conversationId) return c
        const messages = [...c.messages]
        const lastIdx = messages.length - 1
        if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
          messages[lastIdx] = { ...messages[lastIdx], content, usage, timestamp: Date.now() }
        }
        return { ...c, messages, updatedAt: Date.now() }
      }),
    }))
    get().persist()
  },

  appendToLastAssistantMessage: (conversationId, chunk) => {
    set((s) => ({
      conversations: s.conversations.map((c) => {
        if (c.id !== conversationId) return c
        const messages = [...c.messages]
        const lastIdx = messages.length - 1
        if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
          const prev = typeof messages[lastIdx].content === 'string' ? messages[lastIdx].content : ''
          messages[lastIdx] = { ...messages[lastIdx], content: prev + chunk }
        }
        return { ...c, messages }
      }),
    }))
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      get().persist()
      debounceTimer = null
    }, 2000)
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setAbortController: (controller) => set({ abortController: controller }),

  updateConversationTitle: (id, title) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }))
    get().persist()
  },

  clearConversations: () => {
    set({ conversations: [], activeConversationId: null })
    get().persist()
  },

  persist: () => {
    const { conversations } = get()
    saveConversations(conversations)
  },
}))
