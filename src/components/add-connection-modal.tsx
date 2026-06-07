import { useKeyboard, usePaste } from "@opentui/react"
import { useState, useCallback } from "react"
import { addConnection, loadConfig } from "../lib/config.ts"
import { theme } from "../lib/theme.ts"

interface Props {
  onSave: () => void
  onCancel: () => void
}

type Field = "name" | "host" | "port" | "username" | "password" | "database" | "tls"
const FIELDS: Field[] = ["name", "host", "port", "username", "password", "database", "tls"]
const LABELS: Record<Field, string> = {
  name: "Name",
  host: "Host",
  port: "Port",
  username: "Username",
  password: "Password",
  database: "Database",
  tls: "TLS",
}
const DEFAULTS: Record<Field, string> = {
  name: "",
  host: "localhost",
  port: "6379",
  username: "default",
  password: "",
  database: "0",
  tls: "off",
}

export function AddConnectionModal({ onSave, onCancel }: Props) {
  const [values, setValues] = useState<Record<Field, string>>({ ...DEFAULTS })
  const [focusedField, setFocusedField] = useState<Field>("name")
  const [error, setError] = useState<string | null>(null)

  const focusedIndex = FIELDS.indexOf(focusedField)

  const handleSave = useCallback(() => {
    const name = values.name.trim()
    const host = values.host.trim()
    const port = parseInt(values.port, 10)
    const database = parseInt(values.database, 10)

    if (!name) { setError("Name is required"); return }
    if (!host) { setError("Host is required"); return }
    if (isNaN(port) || port < 1 || port > 65535) { setError("Port must be 1-65535"); return }
    if (isNaN(database) || database < 0 || database > 15) { setError("Database must be 0-15"); return }

    const config = loadConfig()
    if (config.connections.some((c) => c.name === name)) {
      setError("A connection with this name already exists")
      return
    }

    addConnection({
      name, host, port,
      username: values.username || "default",
      password: values.password || null,
      database,
      tls: values.tls === "on",
    })
    onSave()
  }, [values, onSave])

  usePaste((event) => {
    const text = new TextDecoder().decode(event.bytes).replace(/[\x00-\x1f]/g, "").trim()
    if (!text) return
    setValues((prev) => ({ ...prev, [focusedField]: prev[focusedField] + text }))
    setError(null)
  })

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel()
      return
    }

    if (key.name === "tab" || (key.name === "down" && !key.meta)) {
      setFocusedField(FIELDS[(focusedIndex + 1) % FIELDS.length]!)
      return
    }

    if ((key.shift && key.name === "tab") || key.name === "up") {
      setFocusedField(FIELDS[(focusedIndex - 1 + FIELDS.length) % FIELDS.length]!)
      return
    }

    if (key.name === "return") {
      handleSave()
      return
    }

    if (focusedField === "tls") {
      if (key.sequence === " " || key.name === "return") {
        setValues((prev) => ({ ...prev, tls: prev.tls === "on" ? "off" : "on" }))
      }
      return
    }

    if (key.name === "backspace" && (key.meta || key.option)) {
      setValues((prev) => {
        const val = prev[focusedField]
        const trimmed = val.trimEnd()
        const lastSpace = trimmed.lastIndexOf(" ")
        return { ...prev, [focusedField]: lastSpace >= 0 ? val.slice(0, lastSpace) : "" }
      })
      setError(null)
      return
    }

    if (key.name === "backspace" && key.ctrl) {
      setValues((prev) => ({ ...prev, [focusedField]: "" }))
      setError(null)
      return
    }

    if (key.name === "backspace") {
      setValues((prev) => ({ ...prev, [focusedField]: prev[focusedField].slice(0, -1) }))
      setError(null)
      return
    }

    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setValues((prev) => ({ ...prev, [focusedField]: prev[focusedField] + key.sequence }))
      setError(null)
    }
  })

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      <box
        flexDirection="column"
        width={50}
        style={{ borderStyle: "rounded", borderColor: theme.accent }}
        padding={1}
        backgroundColor={theme.bg}
        gap={1}
      >
        <text fg={theme.accent}>Add Connection</text>
        <text>{""}</text>

        {FIELDS.map((field) => {
          const isFocused = focusedField === field
          if (field === "tls") {
            const isOn = values.tls === "on"
            return (
              <box key={field} flexDirection="row" height={1}>
                <text fg={theme.textDim} style={{ width: 12 }}>
                  {LABELS[field]}:
                </text>
                <text
                  fg={isFocused ? theme.text : theme.textMuted}
                  bg={isFocused ? theme.bgHighlight : undefined}
                >
                  {isOn ? "[x] Enabled" : "[ ] Disabled"}
                </text>
              </box>
            )
          }
          const display = field === "password" && values[field]
            ? "•".repeat(values[field].length)
            : values[field]
          return (
            <box key={field} flexDirection="row" height={1}>
              <text fg={theme.textDim} style={{ width: 12 }}>
                {LABELS[field]}:
              </text>
              <text
                fg={isFocused ? theme.text : theme.textMuted}
                bg={isFocused ? theme.bgHighlight : undefined}
              >
                {display || (isFocused ? "▎" : "")}
                {isFocused && display ? "▎" : ""}
              </text>
            </box>
          )
        })}

        {error && <text fg={theme.error}>{error}</text>}

        <text>{""}</text>
        <text fg={theme.textDim}>
          <span fg={theme.accent}>Tab</span>/<span fg={theme.accent}>↑↓</span> Navigate{"  "}
          <span fg={theme.accent}>Enter</span> Save{"  "}
          <span fg={theme.accent}>Esc</span> Cancel
        </text>
      </box>
    </box>
  )
}
