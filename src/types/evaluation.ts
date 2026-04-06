export type QuestionCategory =
  | 'math'
  | 'reasoning'
  | 'coding'
  | 'writing'
  | 'tool_use'
  | 'agent'

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5

export interface TestQuestion {
  id: string
  category: QuestionCategory
  prompt: string
  expectedAspects: string[]
  difficulty: DifficultyLevel
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
  score: number
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
  maxPoints: number
  points: number
  judgeModel: string
  judgeProvider: string
  judgeFeedback: string
  notes: string
  createdAt: number
}

export interface CategoryScore {
  category: QuestionCategory
  score: number
  maxScore: number
  count: number
  avgQuality: number
}

export interface DifficultyScore {
  difficulty: DifficultyLevel
  score: number
  maxScore: number
  count: number
  avgQuality: number
}

export interface EvaluationSummary {
  totalScore: number
  maxScore: number
  grade: string
  categoryBreakdown: CategoryScore[]
  difficultyBreakdown: DifficultyScore[]
  avgSpeed: {
    ttfb: number
    tokensPerSecond: number
    totalDurationMs: number
  }
  verdictDistribution: Record<string, number>
  overallVerdict: 'excellent' | 'good' | 'average' | 'poor' | 'fail'
  strengths: string[]
  weaknesses: string[]
}

export interface EvaluationSession {
  id: string
  name: string
  records: EvaluationRecord[]
  summary: EvaluationSummary | null
  createdAt: number
  updatedAt: number
}

export interface QuestionBankFile {
  name: string
  version: number
  createdAt: number
  questions: Omit<TestQuestion, 'id'>[]
}

export const ALL_CATEGORIES: QuestionCategory[] = ['math', 'reasoning', 'coding', 'writing', 'tool_use', 'agent']

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  math: '数学',
  reasoning: '逻辑推理',
  coding: '代码能力',
  writing: '文字能力',
  tool_use: '工具能力',
  agent: 'Agent能力',
}

export const CATEGORY_ICONS: Record<QuestionCategory, string> = {
  math: '📐',
  reasoning: '🧠',
  coding: '💻',
  writing: '✍️',
  tool_use: '🔧',
  agent: '🤖',
}

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  1: '入门',
  2: '基础',
  3: '进阶',
  4: '困难',
  5: '专家',
}

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  1: 'text-green-400',
  2: 'text-cyan-400',
  3: 'text-yellow-400',
  4: 'text-orange-400',
  5: 'text-red-400',
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

export function getGrade(score: number): { grade: string; label: string; color: string } {
  if (score >= 90) return { grade: 'S', label: '卓越', color: 'text-purple-400' }
  if (score >= 80) return { grade: 'A', label: '优秀', color: 'text-green-400' }
  if (score >= 70) return { grade: 'B', label: '良好', color: 'text-blue-400' }
  if (score >= 60) return { grade: 'C', label: '一般', color: 'text-yellow-400' }
  if (score >= 40) return { grade: 'D', label: '较差', color: 'text-orange-400' }
  return { grade: 'F', label: '失败', color: 'text-red-400' }
}

export function computeMaxPoints(questions: TestQuestion[]): Map<string, number> {
  const totalWeight = questions.reduce((sum, q) => sum + q.difficulty, 0)
  const map = new Map<string, number>()
  for (const q of questions) {
    map.set(q.id, totalWeight > 0 ? (q.difficulty / totalWeight) * 100 : 0)
  }
  return map
}
