export interface MCPServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  enabled: boolean
}

export interface MCPServerTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPServerResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPServerPrompt {
  name: string
  description?: string
  arguments?: {
    name: string
    description?: string
    required?: boolean
  }[]
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export interface MCPConnection {
  serverId: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  tools: MCPServerTool[]
  resources: MCPServerResource[]
  prompts: MCPServerPrompt[]
  error?: string
}
