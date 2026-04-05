import { MCPServerConfig, MCPServerTool, MCPConnection, MCPToolResult } from '@/types/mcp'

class MCPManager {
  private connections: Map<string, MCPConnection> = new Map()

  async connect(server: MCPServerConfig): Promise<MCPConnection> {
    const connection: MCPConnection = {
      serverId: server.id,
      status: 'connecting',
      tools: [],
      resources: [],
      prompts: [],
    }

    this.connections.set(server.id, connection)

    try {
      const response = await fetch('http://localhost:3001/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: server.command,
          args: server.args,
          env: server.env,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to connect to MCP server: ${response.statusText}`)
      }

      const data = await response.json()
      connection.status = 'connected'
      connection.tools = data.tools || []
      connection.resources = data.resources || []
      connection.prompts = data.prompts || []
    } catch (error) {
      connection.status = 'error'
      connection.error = error instanceof Error ? error.message : 'Unknown error'
    }

    this.connections.set(server.id, connection)
    return connection
  }

  async disconnect(serverId: string) {
    try {
      await fetch('http://localhost:3001/mcp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      })
    } catch {
      // ignore
    }
    const conn = this.connections.get(serverId)
    if (conn) {
      conn.status = 'disconnected'
      conn.tools = []
      conn.resources = []
      conn.prompts = []
    }
  }

  async executeTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const response = await fetch('http://localhost:3001/mcp/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, toolName, args }),
    })

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.statusText}`)
    }

    return response.json()
  }

  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId)
  }

  getAllConnections(): MCPConnection[] {
    return Array.from(this.connections.values())
  }

  getAllTools(): MCPServerTool[] {
    return Array.from(this.connections.values()).flatMap((c) => c.tools)
  }

  getAllToolsForAPI(): Array<{
    type: 'function'
    function: { name: string; description: string; parameters: MCPServerTool['inputSchema'] }
  }> {
    return this.getAllTools().map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }))
  }
}

export const mcpManager = new MCPManager()
