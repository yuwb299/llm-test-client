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
  // Step 1: Remove editor paste markers first
  let text = content.replace(/\[Pasted\s+~?\d+\s+lines?\]/gi, '')
  
  // Step 2: Normalize LaTeX delimiters - convert \[...\] to $$...$$
  // Use a loop to handle nested/overlapping matches
  let prevText = ''
  while (prevText !== text) {
    prevText = text
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
  }
  
  // Step 3: Normalize \(...\) to $...$
  prevText = ''
  while (prevText !== text) {
    prevText = text
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, '$$$$1$$')
  }
  
  // Step 4: Fix inline math delimiters inside display math
  // Replace $...$ inside $$...$$ with \( ... \) to avoid conflicts
  text = text.replace(/(\$\$[\s\S]*?)\$([^$\n]+)\$(?=.*?\$\$)/g, '$1\\\\($2\\\\)')
  
  // Step 5: Handle math environments
  const mathEnvNames = [
    'equation', 'equation\\*',
    'align', 'align\\*',
    'aligned', 'gather', 'gather\\*',
    'gathered', 'cases', 'array',
    'matrix', 'bmatrix', 'pmatrix',
    'vmatrix', 'Vmatrix',
  ]
  
  for (const envName of mathEnvNames) {
    const re = new RegExp(
      `(?<!\\\$)\\\\begin\{${envName}\}([\s\S]*?)\\\\end\{${envName}\}(?!\\\$)`,
      'g',
    )
    text = text.replace(re, (match) => {
      // Check context: count $$ before and after this match
      const matchIndex = text.indexOf(match)
      if (matchIndex === -1) return match
      
      const beforeMatch = text.slice(0, matchIndex)
      const afterMatch = text.slice(matchIndex + match.length)
      const openCount = (beforeMatch.match(/\$\$/g) || []).length
      const closeCount = (afterMatch.match(/\$\$/g) || []).length
      
      // If already inside math block (unbalanced), don't wrap
      if (openCount !== closeCount) {
        return match
      }
      return `$$${match}$$`
    })
  }
  
  // Step 6: Handle standalone \begin...\end blocks that might have been missed
  text = text.replace(/(?<!\\\$)(\\\\begin\{[^}]+\}[\s\S]*?\\\\end\{[^}]+\})(?!\\\$)/g, '$$$$$1$$$$')
  
  // Step 7: Split by code blocks and process non-code parts
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g)

  return parts.map((part, index) => {
    // Code blocks (odd indices) - check for ```math
    if (index % 2 === 1) {
      const mathBlockMatch = part.match(/^```math\s*\n?([\s\S]*?)```$/)
      if (mathBlockMatch) {
        return `$$\n${mathBlockMatch[1]}$$`
      }
      return part
    }

    // Non-code parts - additional cleanup
    let processed = part
    
    // Fix common issues with broken math delimiters
    // Ensure display math blocks are properly separated
    processed = processed.replace(/\$\$\s*\$\$/g, '') // Remove empty blocks
    
    return processed
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
