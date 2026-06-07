import type { TreeNode } from "../types.ts"

const SEPARATOR = ":"

export function buildTree(keys: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const key of keys) {
    const parts = key.split(SEPARATOR)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      const isLast = i === parts.length - 1
      const fullKey = parts.slice(0, i + 1).join(SEPARATOR)

      let existing = current.find((n) => n.key === part)

      if (!existing) {
        existing = {
          key: part,
          fullKey,
          children: [],
          isLeaf: isLast,
        }
        current.push(existing)
      } else if (isLast) {
        existing.isLeaf = true
      }

      if (!isLast) {
        current = existing.children
      }
    }
  }

  sortTree(root)
  return root
}

function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.isLeaf && a.children.length === 0 && (!b.isLeaf || b.children.length > 0)) return 1
    if (b.isLeaf && b.children.length === 0 && (!a.isLeaf || a.children.length > 0)) return -1
    return a.key.localeCompare(b.key)
  })
  for (const node of nodes) {
    if (node.children.length > 0) sortTree(node.children)
  }
}

export interface FlatNode {
  node: TreeNode
  depth: number
  expanded: boolean
  hasChildren: boolean
}

export function flattenTree(
  nodes: TreeNode[],
  expandedKeys: Set<string>,
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = []

  for (const node of nodes) {
    const hasChildren = node.children.length > 0
    const expanded = expandedKeys.has(node.fullKey)

    result.push({ node, depth, expanded, hasChildren })

    if (hasChildren && expanded) {
      result.push(...flattenTree(node.children, expandedKeys, depth + 1))
    }
  }

  return result
}

export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const lower = query.toLowerCase()
  const filtered: TreeNode[] = []

  for (const node of nodes) {
    const childMatches = filterTree(node.children, query)
    const nameMatches = node.key.toLowerCase().includes(lower)

    if (nameMatches || childMatches.length > 0) {
      filtered.push({
        ...node,
        children: childMatches.length > 0 ? childMatches : node.children,
      })
    }
  }

  return filtered
}
