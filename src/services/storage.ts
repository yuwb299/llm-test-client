import { Conversation } from '@/types/message'
import { ProviderConfig } from '@/types/provider'
import { AppSettings } from '@/types'
import { MCPServerConfig } from '@/types/mcp'
import { defaultSettings } from '@/config/defaults'
import { defaultProviders } from '@/config/providers'

const STORAGE_KEYS = {
  conversations: 'llm_client_conversations',
  providers: 'llm_client_providers',
  settings: 'llm_client_settings',
  mcpServers: 'llm_client_mcp_servers',
  skills: 'llm_client_skills',
}

export function loadConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.conversations)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(conversations))
}

export function loadProviders(): ProviderConfig[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.providers)
    return data ? JSON.parse(data) : defaultProviders
  } catch {
    return defaultProviders
  }
}

export function saveProviders(providers: ProviderConfig[]) {
  localStorage.setItem(STORAGE_KEYS.providers, JSON.stringify(providers))
}

export function loadSettings(): AppSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.settings)
    return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
}

export function loadMCPServers(): MCPServerConfig[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.mcpServers)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveMCPServers(servers: MCPServerConfig[]) {
  localStorage.setItem(STORAGE_KEYS.mcpServers, JSON.stringify(servers))
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
}

const STORAGE_KEY_EVALUATIONS = 'llm_client_evaluations'

export function loadEvaluations(): EvaluationSession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_EVALUATIONS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveEvaluations(sessions: EvaluationSession[]) {
  localStorage.setItem(STORAGE_KEY_EVALUATIONS, JSON.stringify(sessions))
}

import { EvaluationSession } from '@/types/evaluation'
import { InteractionLog } from '@/types/log'

const STORAGE_KEY_LOGS = 'llm_client_logs'

export function loadLogs(): InteractionLog[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_LOGS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveLogs(logs: InteractionLog[]) {
  localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs))
}
