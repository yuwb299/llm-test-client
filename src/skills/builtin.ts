import { SkillDefinition } from './base'

export const codeReviewSkill: SkillDefinition = {
  id: 'code-review',
  name: 'Code Review',
  description: 'Review code for bugs, security issues, and best practices',
  icon: '🔍',
  version: '1.0.0',
  systemPrompt: `You are an expert code reviewer. Analyze the provided code and give feedback on:
1. **Bugs & Issues**: Identify any bugs or logical errors
2. **Security**: Check for security vulnerabilities
3. **Performance**: Suggest performance improvements
4. **Best Practices**: Recommend coding best practices
5. **Readability**: Assess code readability and maintainability

Format your review with clear sections and code examples where appropriate.`,
  parameters: [
    {
      key: 'language',
      label: 'Programming Language',
      type: 'select',
      options: [
        { label: 'Auto Detect', value: 'auto' },
        { label: 'TypeScript', value: 'typescript' },
        { label: 'Python', value: 'python' },
        { label: 'Java', value: 'java' },
        { label: 'Go', value: 'go' },
        { label: 'Rust', value: 'rust' },
        { label: 'C++', value: 'cpp' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'focus',
      label: 'Review Focus',
      type: 'select',
      options: [
        { label: 'All Aspects', value: 'all' },
        { label: 'Security Only', value: 'security' },
        { label: 'Performance Only', value: 'performance' },
        { label: 'Style Only', value: 'style' },
      ],
      defaultValue: 'all',
    },
  ],
  processMessage: (message, params) => {
    const lang = params?.language === 'auto' ? '' : `Language: ${params?.language}\n`
    const focus = params?.focus === 'all' ? '' : `Focus: ${params?.focus}\n`
    return `${lang}${focus}\n\`\`\`\n${message}\n\`\`\``
  },
}

export const translationSkill: SkillDefinition = {
  id: 'translation',
  name: 'Translation',
  description: 'Translate text between languages with context awareness',
  icon: '🌐',
  version: '1.0.0',
  systemPrompt: `You are a professional translator. Translate the given text accurately while preserving:
- Original tone and style
- Technical terminology
- Cultural context
- Formatting (markdown, code blocks, etc.)

Provide the translation directly without explanation unless asked.`,
  parameters: [
    {
      key: 'source_lang',
      label: 'Source Language',
      type: 'select',
      options: [
        { label: 'Auto Detect', value: 'auto' },
        { label: 'English', value: 'en' },
        { label: 'Chinese', value: 'zh' },
        { label: 'Japanese', value: 'ja' },
        { label: 'Korean', value: 'ko' },
        { label: 'French', value: 'fr' },
        { label: 'German', value: 'de' },
        { label: 'Spanish', value: 'es' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'target_lang',
      label: 'Target Language',
      type: 'select',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Chinese', value: 'zh' },
        { label: 'Japanese', value: 'ja' },
        { label: 'Korean', value: 'ko' },
        { label: 'French', value: 'fr' },
        { label: 'German', value: 'de' },
        { label: 'Spanish', value: 'es' },
      ],
      defaultValue: 'zh',
    },
  ],
  processMessage: (message, params) => {
    const src = params?.source_lang === 'auto' ? 'auto-detect' : params?.source_lang
    return `Translate the following from ${src} to ${params?.target_lang || 'zh'}:\n\n${message}`
  },
}

export const summarizerSkill: SkillDefinition = {
  id: 'summarizer',
  name: 'Summarizer',
  description: 'Summarize long texts into concise overviews',
  icon: '📝',
  version: '1.0.0',
  systemPrompt: `You are an expert at summarization. Create a clear, concise summary of the provided text.

Rules:
- Capture all key points
- Maintain logical structure
- Use bullet points for multiple items
- Keep technical accuracy
- Include important numbers/data`,
  parameters: [
    {
      key: 'length',
      label: 'Summary Length',
      type: 'select',
      options: [
        { label: 'Brief (1-2 sentences)', value: 'brief' },
        { label: 'Medium (1 paragraph)', value: 'medium' },
        { label: 'Detailed (multiple paragraphs)', value: 'detailed' },
      ],
      defaultValue: 'medium',
    },
    {
      key: 'format',
      label: 'Output Format',
      type: 'select',
      options: [
        { label: 'Paragraph', value: 'paragraph' },
        { label: 'Bullet Points', value: 'bullets' },
        { label: 'Structured (sections)', value: 'structured' },
      ],
      defaultValue: 'bullets',
    },
  ],
  processMessage: (message, params) => {
    return `Summarize the following text (${params?.length || 'medium'} length, in ${params?.format || 'bullets'} format):\n\n${message}`
  },
}

export const jsonGeneratorSkill: SkillDefinition = {
  id: 'json-generator',
  name: 'JSON Generator',
  description: 'Generate structured JSON from natural language descriptions',
  icon: '📋',
  version: '1.0.0',
  systemPrompt: `You are a JSON schema and data generator. Generate valid JSON based on the user's description.

Rules:
- Always output valid JSON
- Include appropriate data types
- Add sample data where applicable
- Follow naming conventions (camelCase for keys)
- Include nested structures when needed`,
  parameters: [
    {
      key: 'schema_only',
      label: 'Output Mode',
      type: 'select',
      options: [
        { label: 'Sample Data', value: 'data' },
        { label: 'JSON Schema', value: 'schema' },
        { label: 'Both', value: 'both' },
      ],
      defaultValue: 'data',
    },
  ],
}

export const explainCodeSkill: SkillDefinition = {
  id: 'explain-code',
  name: 'Code Explainer',
  description: 'Explain code step by step in plain language',
  icon: '📖',
  version: '1.0.0',
  systemPrompt: `You are a coding instructor. Explain the provided code clearly:

1. Give a high-level overview of what the code does
2. Break down each section step by step
3. Explain key concepts and patterns used
4. Note any edge cases or important behaviors
5. Use analogies where helpful for beginners`,
  parameters: [
    {
      key: 'detail_level',
      label: 'Detail Level',
      type: 'select',
      options: [
        { label: 'Beginner', value: 'beginner' },
        { label: 'Intermediate', value: 'intermediate' },
        { label: 'Expert', value: 'expert' },
      ],
      defaultValue: 'intermediate',
    },
  ],
  processMessage: (message, params) => {
    return `Explain this code at a ${params?.detail_level || 'intermediate'} level:\n\n\`\`\`\n${message}\n\`\`\``
  },
}
