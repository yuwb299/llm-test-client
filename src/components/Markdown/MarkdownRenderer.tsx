import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import 'katex/dist/katex.min.css'
import { CodeBlock } from './CodeBlock'

interface MarkdownRendererProps {
  content: string
  className?: string
}

function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (!children) return ''
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (React.isValidElement(children)) return extractText((children.props as any).children)
  return ''
}

function preprocessMathContent(content: string): string {
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g)

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const mathBlockMatch = part.match(/^```math\s*\n?([\s\S]*?)```$/)
      if (mathBlockMatch) {
        return `$$\n${mathBlockMatch[1]}$$`
      }
      return part
    }

    let text = part
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`)
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`)

    const mathEnvNames = [
      'equation', 'equation\\*',
      'align', 'align\\*',
      'aligned', 'gather', 'gather\\*',
      'gathered', 'cases',
    ]
    for (const envName of mathEnvNames) {
      const re = new RegExp(
        `(?<!\\$)\\\\begin\\{${envName}\\}([\\s\\S]*?)\\\\end\\{${envName}\\}(?!\\$)`,
        'g',
      )
      text = text.replace(re, (match, m) => `$$${match}$$`)
    }

    return text
  }).join('')
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const processedContent = useMemo(() => preprocessMathContent(content), [content])

  return (
    <div className={`markdown-body ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          pre({ children }) {
            return <>{children}</>
          },
          code({ className, children, node, ...props }) {
            const classStr = String(className || '')
            const nodeClasses: readonly string[] =
              Array.isArray(node?.properties?.className)
                ? (node.properties.className as string[])
                : []
            const isMath =
              classStr.includes('language-math') ||
              classStr.includes('math-inline') ||
              classStr.includes('math-display') ||
              nodeClasses.includes('language-math') ||
              nodeClasses.includes('math-inline') ||
              nodeClasses.includes('math-display')
            if (isMath) {
              return <code className={className} {...props}>{children}</code>
            }

            const match = /language-(\w+)/.exec(classStr)
            const language = match ? match[1] : ''
            const codeStr = extractText(children).replace(/\n$/, '')

            if (match || codeStr.includes('\n')) {
              return <CodeBlock language={language} code={codeStr} />
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="w-full border-collapse">{children}</table>
              </div>
            )
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
})