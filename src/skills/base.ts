import { Skill, SkillParameter } from '@/types/skill'

export interface SkillDefinition {
  id: string
  name: string
  description: string
  icon: string
  version: string
  systemPrompt: string
  parameters: SkillParameter[]
  processMessage?: (message: string, params?: Record<string, string>) => string
}

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map()

  register(skill: SkillDefinition) {
    this.skills.set(skill.id, skill)
  }

  unregister(id: string) {
    this.skills.delete(id)
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id)
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  applySkill(skillId: string, message: string, params?: Record<string, string>): { systemPrompt: string; processedMessage: string } | null {
    const skill = this.skills.get(skillId)
    if (!skill) return null

    let processedMessage = message
    if (skill.processMessage) {
      processedMessage = skill.processMessage(message, params)
    }

    return {
      systemPrompt: skill.systemPrompt,
      processedMessage,
    }
  }
}

export const skillRegistry = new SkillRegistry()
