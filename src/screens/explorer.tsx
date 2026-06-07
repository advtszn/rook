import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { useState, useEffect, useCallback, useRef } from "react"
import type { Connection, Screen, TreeNode } from "../types.ts"
import { connectToRedis, scanKeys, disconnectRedis } from "../lib/redis.ts"
import { buildTree, flattenTree, filterTree, type FlatNode } from "../lib/tree.ts"

interface Props {
  connection: Connection
  onNavigate: (screen: Screen) => void
}

export function ExplorerScreen({ connection, onNavigate }: Props) {
  const renderer = useRenderer()
  const { height } = useTerminalDimensions()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchMode, setSearchMode] = useState(false)
  const [scrollOffset, setScrollOffset] = useState(0)

  const visibleHeight = height - 5

  const displayTree = searchQuery ? filterTree(tree, searchQuery) : tree
  const flatNodes = flattenTree(displayTree, expandedKeys)

  useEffect(() => {
    setSelectedIndex((i: number) => Math.min(i, Math.max(0, flatNodes.length - 1)))
  }, [flatNodes.length])

  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex)
    } else if (selectedIndex >= scrollOffset + visibleHeight) {
      setScrollOffset(selectedIndex - visibleHeight + 1)
    }
  }, [selectedIndex, scrollOffset, visibleHeight])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const client = connectToRedis(connection)
        await client.connect()
        const keys = await scanKeys(client)
        if (!cancelled) {
          setTree(buildTree(keys))
          setLoading(false)
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Connection failed")
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [connection])

  const handleExpand = useCallback(
    (node: FlatNode) => {
      if (node.hasChildren) {
        setExpandedKeys((keys: Set<string>) => {
          const next = new Set(keys)
          if (next.has(node.node.fullKey)) {
            next.delete(node.node.fullKey)
          } else {
            next.add(node.node.fullKey)
          }
          return next
        })
      }
    },
    [],
  )

  useKeyboard((key) => {
    if (searchMode) {
      if (key.name === "escape") {
        setSearchMode(false)
        setSearchQuery("")
        return
      }
      if (key.name === "return") {
        setSearchMode(false)
        return
      }
      if (key.name === "backspace") {
        setSearchQuery((q: string) => q.slice(0, -1))
        setSelectedIndex(0)
        return
      }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setSearchQuery((q: string) => q + key.sequence)
        setSelectedIndex(0)
        return
      }
      return
    }

    if (key.name === "q" || key.name === "escape") {
      disconnectRedis()
      onNavigate({ type: "connections" })
      return
    }

    if (key.name === "j" || key.name === "down") {
      setSelectedIndex((i: number) => Math.min(i + 1, flatNodes.length - 1))
    } else if (key.name === "k" || key.name === "up") {
      setSelectedIndex((i: number) => Math.max(i - 1, 0))
    } else if (key.name === "l" || key.name === "right" || key.name === "return") {
      const current = flatNodes[selectedIndex]
      if (current) {
        if (current.hasChildren) {
          if (!current.expanded) {
            handleExpand(current)
          } else if (key.name === "return" && current.node.isLeaf) {
            onNavigate({
              type: "inspector",
              connection,
              redisKey: current.node.fullKey,
            })
          }
        } else if (current.node.isLeaf) {
          onNavigate({
            type: "inspector",
            connection,
            redisKey: current.node.fullKey,
          })
        }
      }
    } else if (key.name === "h" || key.name === "left") {
      const current = flatNodes[selectedIndex]
      if (current) {
        if (current.expanded) {
          handleExpand(current)
        }
      }
    } else if (key.name === "g" && !key.shift) {
      setSelectedIndex(0)
    } else if (key.name === "g" && key.shift) {
      setSelectedIndex(Math.max(0, flatNodes.length - 1))
    } else if (key.sequence === "/") {
      setSearchMode(true)
      setSearchQuery("")
    }
  })

  if (error) {
    return (
      <box flexDirection="column" width="100%" height="100%" padding={1}>
        <text fg="#f7768e">Unable to connect</text>
        <text>{""}</text>
        <text fg="#565f89">Host: {connection.host}</text>
        <text fg="#565f89">Port: {connection.port}</text>
        <text>{""}</text>
        <text fg="#565f89">{error}</text>
        <text>{""}</text>
        <text fg="#565f89">Press any key to return.</text>
      </box>
    )
  }

  if (loading) {
    return (
      <box flexDirection="column" width="100%" height="100%" padding={1}>
        <text fg="#7aa2f7">Connecting to {connection.name}...</text>
      </box>
    )
  }

  if (flatNodes.length === 0 && !searchQuery) {
    return (
      <box flexDirection="column" width="100%" height="100%" padding={1}>
        <text fg="#7aa2f7">{connection.name}</text>
        <text>{""}</text>
        <text fg="#565f89">No keys found.</text>
        <text>{""}</text>
        <text fg="#565f89">Press q to return.</text>
      </box>
    )
  }

  const visibleNodes = flatNodes.slice(scrollOffset, scrollOffset + visibleHeight)

  return (
    <box flexDirection="column" width="100%" height="100%">
      <box flexDirection="column" padding={1} flexGrow={1}>
        <text fg="#7aa2f7">{"  "}{connection.name}</text>
        <text>{""}</text>

        {visibleNodes.map((flat, viewIndex) => {
          const actualIndex = scrollOffset + viewIndex
          const isSelected = actualIndex === selectedIndex
          const indent = "  " + "  ".repeat(flat.depth)
          const icon = flat.hasChildren
            ? flat.expanded
              ? "▼ "
              : "▶ "
            : "  "
          const suffix = flat.hasChildren && !flat.expanded
            ? ` (${flat.node.children.length})`
            : ""

          return (
            <text
              key={flat.node.fullKey + actualIndex}
              fg={isSelected ? "#c0caf5" : "#787c99"}
              bg={isSelected ? "#283457" : undefined}
            >
              {indent}{isSelected ? "› " : "  "}{icon}{flat.node.key}
              <span fg="#565f89">{suffix}</span>
            </text>
          )
        })}

        {flatNodes.length === 0 && searchQuery && (
          <text fg="#565f89">{"  "}No matches for "{searchQuery}"</text>
        )}
      </box>

      <box
        width="100%"
        height={1}
        backgroundColor="#1a1b26"
        flexDirection="row"
        paddingX={1}
      >
        {searchMode ? (
          <text fg="#c0caf5">
            /{searchQuery}▎
          </text>
        ) : (
          <text fg="#565f89">
            {searchQuery && <span fg="#787c99">/{searchQuery}  </span>}
            <span fg="#7aa2f7">h</span>/<span fg="#7aa2f7">l</span> Collapse/Expand{"  "}
            <span fg="#7aa2f7">/</span> Search{"  "}
            <span fg="#7aa2f7">Enter</span> Inspect{"  "}
            <span fg="#7aa2f7">q</span> Back
          </text>
        )}
      </box>

      <box
        width="100%"
        height={1}
        backgroundColor="#1a1b26"
        paddingX={1}
      >
        <text fg="#565f89">
          Path: /{flatNodes[selectedIndex]?.node.fullKey.replace(/:/g, "/") ?? ""}
        </text>
      </box>
    </box>
  )
}
