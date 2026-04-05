import { create } from 'zustand'
import { ProviderConfig } from '@/types/provider'
import { loadProviders, saveProviders } from '@/services/storage'
import { defaultProviders } from '@/config/providers'
import { providerRegistry } from '@/providers'

interface ProviderState {
  providers: ProviderConfig[]
  activeProviderId: string
  activeModelId: string

  loadFromStorage: () => void
  setProviders: (providers: ProviderConfig[]) => void
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => void
  addProvider: (provider: ProviderConfig) => void
  removeProvider: (id: string) => void
  setActiveProvider: (providerId: string) => void
  setActiveModel: (modelId: string) => void
  getActiveProvider: () => ProviderConfig | undefined
  getActiveModel: () => ProviderConfig['models'][0] | undefined
  registerAll: () => void
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: defaultProviders,
  activeProviderId: 'ollama',
  activeModelId: 'gemma4-31b-local:latest',

  loadFromStorage: () => {
    const providers = loadProviders()
    set({ providers })
    get().registerAll()
  },

  setProviders: (providers) => {
    set({ providers })
    saveProviders(providers)
    get().registerAll()
  },

  updateProvider: (id, updates) => {
    set((s) => ({
      providers: s.providers.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
    const { providers } = get()
    saveProviders(providers)
    const updated = providers.find((p) => p.id === id)
    if (updated) providerRegistry.register(updated)
  },

  addProvider: (provider) => {
    set((s) => ({ providers: [...s.providers, provider] }))
    const { providers } = get()
    saveProviders(providers)
    providerRegistry.register(provider)
  },

  removeProvider: (id) => {
    set((s) => ({ providers: s.providers.filter((p) => p.id !== id) }))
    const { providers } = get()
    saveProviders(providers)
    providerRegistry.unregister(id)
  },

  setActiveProvider: (providerId) => {
    const { providers } = get()
    const provider = providers.find((p) => p.id === providerId)
    set({
      activeProviderId: providerId,
      activeModelId: provider?.models[0]?.id || '',
    })
  },

  setActiveModel: (modelId) => set({ activeModelId: modelId }),

  getActiveProvider: () => {
    const { providers, activeProviderId } = get()
    return providers.find((p) => p.id === activeProviderId)
  },

  getActiveModel: () => {
    const provider = get().getActiveProvider()
    return provider?.models.find((m) => m.id === get().activeModelId)
  },

  registerAll: () => {
    const { providers } = get()
    providers.filter((p) => p.enabled).forEach((p) => providerRegistry.register(p))
  },
}))
