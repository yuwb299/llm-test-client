export type QuestionCategory =
  | 'reasoning'
  | 'coding'
  | 'math'
  | 'writing'
  | 'knowledge'
  | 'creative'
  | 'instruction_following'
  | 'multilingual'
  | 'safety'
  | 'custom'

export interface TestQuestion {
  id: string
  category: QuestionCategory
  prompt: string
  expectedAspects: string[]
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface EvaluationMetrics {
  speed: {
    ttfb: number
    tokensPerSecond: number
    totalDurationMs: number
    outputTokens: number
  }
  quality: {
    relevance: number
    accuracy: number
    completeness: number
    clarity: number
    overall: number
  }
  verdict: 'excellent' | 'good' | 'average' | 'poor' | 'fail'
}

export interface EvaluationRecord {
  id: string
  questionId: string
  question: TestQuestion
  localModel: string
  localProvider: string
  response: string
  metrics: EvaluationMetrics
  judgeModel: string
  judgeProvider: string
  judgeFeedback: string
  notes: string
  createdAt: number
}

export interface EvaluationSession {
  id: string
  name: string
  records: EvaluationRecord[]
  createdAt: number
  updatedAt: number
}

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  reasoning: '逻辑推理',
  coding: '编程能力',
  math: '数学计算',
  writing: '写作表达',
  knowledge: '知识问答',
  creative: '创意生成',
  instruction_following: '指令遵循',
  multilingual: '多语言',
  safety: '安全合规',
  custom: '自定义',
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export const VERDICT_LABELS: Record<string, string> = {
  excellent: '优秀',
  good: '良好',
  average: '一般',
  poor: '较差',
  fail: '失败',
}

export const VERDICT_COLORS: Record<string, string> = {
  excellent: 'text-green-400',
  good: 'text-blue-400',
  average: 'text-yellow-400',
  poor: 'text-orange-400',
  fail: 'text-red-400',
}
