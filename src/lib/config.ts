import { homedir } from "os"
import { join } from "path"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import type { Config, Connection } from "../types.ts"

const CONFIG_DIR = join(homedir(), ".config", "rook")
const CONFIG_PATH = join(CONFIG_DIR, "config.json")

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function loadConfig(): Config {
  ensureConfigDir()
  if (!existsSync(CONFIG_PATH)) {
    return { connections: [] }
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8")
  return JSON.parse(raw) as Config
}

export function saveConfig(config: Config) {
  ensureConfigDir()
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function addConnection(conn: Connection) {
  const config = loadConfig()
  config.connections.push(conn)
  saveConfig(config)
}

export function deleteConnection(name: string) {
  const config = loadConfig()
  config.connections = config.connections.filter((c) => c.name !== name)
  saveConfig(config)
}
