import { AppSettings } from '@/types'

export const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'zh-CN',
  defaultProvider: 'ollama',
  defaultModel: 'gemma4-31b-local:latest',
  sendOnEnter: true,
  showTokenCount: true,
  showTimestamp: true,
  fontSize: 14,
  maxContextMessages: 50,
  streamEnabled: true,
  temperature: 0.7,
  topP: 1.0,
  maxTokens: 4096,
}
