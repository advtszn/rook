import { useKeyboard } from "@opentui/react"
import { useState, useCallback } from "react"
import { addConnection, loadConfig } from "../lib/config.ts"

interface Props {
  onSave: () => void
  onCancel: () => void
}

type Field = "name" | "host" | "port" | "password"
const FIELDS: Field[] = ["name", "host", "port", "password"]
const LABELS: Record<Field, string> = {
  name: "Name",
  host: "Host",
  port: "Port",
  password: "Password",
}
const DEFAULTS: Record<Field, string> = {
  name: "",
  host: "localhost",
  port: "6379",
  password: "",
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

    if (!name) {
      setError("Name is required")
      return
    }
    if (!host) {
      setError("Host is required")
      return
    }
    if (isNaN(port) || port < 1 || port > 65535) {
      setError("Port must be a valid number (1-65535)")
      return
    }

    const config = loadConfig()
    if (config.connections.some((c) => c.name === name)) {
      setError("A connection with this name already exists")
      return
    }

    addConnection({
      name,
      host,
      port,
      password: values.password || null,
      database: 0,
    })
    onSave()
  }, [values, onSave])

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel()
      return
    }

    if (key.name === "tab" || (key.name === "down" && !key.meta)) {
      const next = FIELDS[(focusedIndex + 1) % FIELDS.length]!
      setFocusedField(next)
      return
    }

    if (key.shift && key.name === "tab") {
      const prev = FIELDS[(focusedIndex - 1 + FIELDS.length) % FIELDS.length]!
      setFocusedField(prev)
      return
    }

    if (key.name === "up") {
      const prev = FIELDS[(focusedIndex - 1 + FIELDS.length) % FIELDS.length]!
      setFocusedField(prev)
      return
    }

    if (key.name === "return") {
      handleSave()
      return
    }

    if (key.name === "backspace") {
      setValues((prev: Record<Field, string>) => ({
        ...prev,
        [focusedField]: prev[focusedField].slice(0, -1),
      }))
      setError(null)
      return
    }

    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setValues((prev: Record<Field, string>) => ({
        ...prev,
        [focusedField]: prev[focusedField] + key.sequence,
      }))
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
        style={{
          borderStyle: "rounded",
          borderColor: "#7aa2f7",
        }}
        padding={1}
        backgroundColor="#1a1b26"
        gap={1}
      >
        <text fg="#7aa2f7">Add Connection</text>
        <text>{""}</text>

        {FIELDS.map((field) => (
          <box key={field} flexDirection="row" height={1}>
            <text fg="#565f89" style={{ width: 12 }}>
              {LABELS[field]}:
            </text>
            <text
              fg={focusedField === field ? "#c0caf5" : "#787c99"}
              bg={focusedField === field ? "#283457" : undefined}
            >
              {values[field] || (focusedField === field ? "▎" : "")}
              {focusedField === field && values[field] ? "▎" : ""}
            </text>
          </box>
        ))}

        {error && (
          <text fg="#f7768e">{error}</text>
        )}

        <text>{""}</text>
        <text fg="#565f89">
          <span fg="#7aa2f7">Tab</span>/<span fg="#7aa2f7">↑↓</span> Navigate{"  "}
          <span fg="#7aa2f7">Enter</span> Save{"  "}
          <span fg="#7aa2f7">Esc</span> Cancel
        </text>
      </box>
    </box>
  )
}
