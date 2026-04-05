import { create } from 'zustand'
import { EvaluationSession, EvaluationRecord, TestQuestion } from '@/types/evaluation'
import { loadEvaluations, saveEvaluations } from '@/services/storage'
import { generateId } from '@/utils/helpers'

interface EvaluationState {
  sessions: EvaluationSession[]
  activeSessionId: string | null
  isRunning: boolean
  currentProgress: { completed: number; total: number } | null

  getActiveSession: () => EvaluationSession | undefined
  createSession: (name: string) => string
  deleteSession: (id: string) => void
  setActiveSession: (id: string | null) => void
  addRecord: (sessionId: string, record: EvaluationRecord) => void
  updateRecordNotes: (sessionId: string, recordId: string, notes: string) => void
  deleteRecord: (sessionId: string, recordId: string) => void
  setRunning: (running: boolean) => void
  setProgress: (progress: { completed: number; total: number } | null) => void
  persist: () => void
}

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  sessions: loadEvaluations(),
  activeSessionId: null,
  isRunning: false,
  currentProgress: null,

  getActiveSession: () => {
    const { sessions, activeSessionId } = get()
    return sessions.find((s) => s.id === activeSessionId)
  },

  createSession: (name) => {
    const id = generateId()
    const session: EvaluationSession = {
      id,
      name,
      records: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: id,
    }))
    get().persist()
    return id
  },

  deleteSession: (id) => {
    set((s) => ({
      sessions: s.sessions.filter((ses) => ses.id !== id),
      activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
    }))
    get().persist()
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  addRecord: (sessionId, record) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId
          ? { ...ses, records: [...ses.records, record], updatedAt: Date.now() }
          : ses
      ),
    }))
    get().persist()
  },

  updateRecordNotes: (sessionId, recordId, notes) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId
          ? {
              ...ses,
              records: ses.records.map((r) => (r.id === recordId ? { ...r, notes } : r)),
              updatedAt: Date.now(),
            }
          : ses
      ),
    }))
    get().persist()
  },

  deleteRecord: (sessionId, recordId) => {
    set((s) => ({
      sessions: s.sessions.map((ses) =>
        ses.id === sessionId
          ? { ...ses, records: ses.records.filter((r) => r.id !== recordId), updatedAt: Date.now() }
          : ses
      ),
    }))
    get().persist()
  },

  setRunning: (running) => set({ isRunning: running }),
  setProgress: (progress) => set({ currentProgress: progress }),

  persist: () => {
    const { sessions } = get()
    saveEvaluations(sessions)
  },
}))

export const QUESTION_TEMPLATES: Omit<TestQuestion, 'id'>[] = [
  {
    category: 'reasoning',
    difficulty: 'medium',
    prompt: '如果一个农夫有17只羊，除了9只以外都走了，还剩几只？请逐步推理。',
    expectedAspects: ['正确答案为9', '展示逐步推理过程'],
  },
  {
    category: 'reasoning',
    difficulty: 'hard',
    prompt: '有三个盒子，一个只装苹果，一个只装橘子，一个装两者。所有标签都贴错了。你只能打开一个盒子拿出一个水果来判断。应该打开哪个盒子？请详细解释推理过程。',
    expectedAspects: ['正确选择混合标签的盒子', '清晰的逻辑推导', '解释所有盒子的正确标签'],
  },
  {
    category: 'coding',
    difficulty: 'easy',
    prompt: '用Python写一个函数，判断一个字符串是否是回文。',
    expectedAspects: ['正确的函数实现', '处理边界情况', '代码简洁'],
  },
  {
    category: 'coding',
    difficulty: 'medium',
    prompt: '用TypeScript实现一个LRU缓存，支持get和put操作，时间复杂度均为O(1)。',
    expectedAspects: ['使用Map和双向链表', 'O(1)的get和put', '正确处理容量淘汰', '类型定义完善'],
  },
  {
    category: 'coding',
    difficulty: 'hard',
    prompt: '实现一个并发任务调度器，最多同时执行N个异步任务，支持优先级队列和任务取消。',
    expectedAspects: ['并发控制逻辑正确', '优先级队列实现', '取消机制', '错误处理', 'TypeScript类型'],
  },
  {
    category: 'math',
    difficulty: 'easy',
    prompt: '计算: (3.14 × 2.5 + 1.86 × 3.5) ÷ 4 的值，保留两位小数。',
    expectedAspects: ['计算过程正确', '结果准确', '保留两位小数'],
  },
  {
    category: 'math',
    difficulty: 'hard',
    prompt: '用数学归纳法证明：对所有正整数n，1² + 2² + 3² + ... + n² = n(n+1)(2n+1)/6。',
    expectedAspects: ['基础步骤正确', '归纳假设清晰', '归纳步骤推导完整', '数学符号使用正确'],
  },
  {
    category: 'writing',
    difficulty: 'medium',
    prompt: '以"如果我有一天时间可以回到过去"为题，写一篇300字左右的短文。要求文笔流畅，有情感深度。',
    expectedAspects: ['切合主题', '文笔流畅', '情感深度', '结构完整', '字数控制'],
  },
  {
    category: 'knowledge',
    difficulty: 'medium',
    prompt: '解释量子纠缠的基本原理，以及它与经典物理学的主要区别。使用通俗但准确的语言。',
    expectedAspects: ['量子纠缠定义准确', '与经典物理对比', '通俗性', '科学准确性'],
  },
  {
    category: 'instruction_following',
    difficulty: 'medium',
    prompt: '请写一首关于程序员的五行诗。要求：1) 每行不超过10个字 2) 不使用"代码"和"bug"这两个词 3) 第二行以动词开头 4) 最后一行表达积极情感',
    expectedAspects: ['五行的格式', '每行不超过10个字', '避开禁用词', '第二行动词开头', '最后一行积极情感'],
  },
  {
    category: 'creative',
    difficulty: 'medium',
    prompt: '设计一个从未存在过的颜色，描述它的外观、给人的感觉、适合用什么物品来比喻，以及它在一个幻想世界中的来源故事。',
    expectedAspects: ['颜色描述生动', '比喻恰当', '故事有创意', '描述有层次'],
  },
  {
    category: 'multilingual',
    difficulty: 'medium',
    prompt: '请将以下句子翻译成英文、日文和法文："在这个世界上，没有什么比真诚的友谊更珍贵的了。" 然后分析三种译文的语言特点差异。',
    expectedAspects: ['英文翻译准确', '日文翻译准确', '法文翻译准确', '语言特点分析有深度'],
  },
  {
    category: 'reasoning',
    difficulty: 'easy',
    prompt: '小明说："我说的这句话是假的。" 请分析这句话是否为真，并解释为什么。',
    expectedAspects: ['识别悖论', '逻辑分析', '清晰解释'],
  },
  {
    category: 'coding',
    difficulty: 'easy',
    prompt: '解释JavaScript中的闭包（closure）是什么，并举一个实际应用的例子。',
    expectedAspects: ['定义准确', '举例恰当', '解释清晰', '实际应用场景'],
  },
  {
    category: 'knowledge',
    difficulty: 'easy',
    prompt: '简述HTTP和HTTPS的主要区别，以及为什么现代网站都应该使用HTTPS。',
    expectedAspects: ['技术区别准确', '安全性解释', '实际意义'],
  },
  {
    category: 'writing',
    difficulty: 'hard',
    prompt: '写一封正式的商业邮件：向一个重要客户解释产品延期交付的原因（供应链问题），同时保持客户信心并提出补偿方案。',
    expectedAspects: ['格式规范', '语气专业', '解释合理', '补偿方案可行', '保持客户信心'],
  },
  {
    category: 'math',
    difficulty: 'medium',
    prompt: '一个房间里有50个人。证明：其中至少有两人的生日在同一个月。（不需要考虑具体日期）',
    expectedAspects: ['使用鸽巢原理', '逻辑清晰', '证明完整'],
  },
  {
    category: 'creative',
    difficulty: 'hard',
    prompt: '设计一套完整的桌游规则，主题是"太空殖民"。包括：游戏目标、玩家数量、回合流程、资源系统、胜利条件。要求规则清晰可执行。',
    expectedAspects: ['规则完整', '可执行性', '平衡性考虑', '创意性', '结构清晰'],
  },
  {
    category: 'instruction_following',
    difficulty: 'hard',
    prompt: '请按以下格式输出一个JSON对象：包含一个"animals"数组，数组中有3个对象，每个对象有name（字符串）、sound（字符串）、legs（数字）三个字段。其中第二个动物的legs必须是奇数。不要输出任何其他文字。',
    expectedAspects: ['纯JSON输出', '正确的数据结构', '3个动物', '第二个legs为奇数'],
  },
  {
    category: 'reasoning',
    difficulty: 'medium',
    prompt: '你有12个外观相同的球，其中一个重量不同（可能偏重或偏轻）。用天平最少需要称几次才能确保找出异常球并判断它是偏重还是偏轻？描述你的策略。',
    expectedAspects: ['最少称量次数', '策略描述清晰', '逻辑正确', '覆盖所有情况'],
  },
]
