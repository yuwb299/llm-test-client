import { skillRegistry } from './base'
import {
  codeReviewSkill,
  translationSkill,
  summarizerSkill,
  jsonGeneratorSkill,
  explainCodeSkill,
} from './builtin'

export function registerBuiltinSkills() {
  skillRegistry.register(codeReviewSkill)
  skillRegistry.register(translationSkill)
  skillRegistry.register(summarizerSkill)
  skillRegistry.register(jsonGeneratorSkill)
  skillRegistry.register(explainCodeSkill)
}

export { skillRegistry }
