export interface Connection {
  name: string
  host: string
  port: number
  password: string | null
  database: number
}

export interface Config {
  connections: Connection[]
}

export interface TreeNode {
  key: string
  fullKey: string
  children: TreeNode[]
  isLeaf: boolean
}

export type Screen =
  | { type: "connections" }
  | { type: "explorer"; connection: Connection }
  | { type: "inspector"; connection: Connection; redisKey: string }
