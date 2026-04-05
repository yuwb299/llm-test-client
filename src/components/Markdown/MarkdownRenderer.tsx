import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
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

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
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
            const isMath = node?.data?.meta === 'math' || node?.tagName === 'math'
            if (isMath) {
              return <code className={className} {...props}>{children}</code>
            }

            const match = /language-(\w+)/.exec(className || '')
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
        {content}
      </ReactMarkdown>
    </div>
  )
})