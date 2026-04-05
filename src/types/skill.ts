export interface Skill {
  id: string
  name: string
  description: string
  icon?: string
  version: string
  enabled: boolean
  systemPrompt: string
  parameters?: SkillParameter[]
  processMessage?: (message: string, params?: Record<string, string>) => string
}

export interface SkillParameter {
  key: string
  label: string
  type: 'text' | 'select' | 'number' | 'boolean'
  defaultValue?: string
  options?: { label: string; value: string }[]
  required?: boolean
}

export interface SkillInstance {
  skill: Skill
  params: Record<string, string>
  enabled: boolean
}
