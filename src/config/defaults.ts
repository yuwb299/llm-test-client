import { AppSettings } from '@/types'

export const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'zh-CN',
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o',
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
