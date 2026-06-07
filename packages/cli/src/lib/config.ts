import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config, Connection } from "../types.ts";

const CONFIG_DIR = join(homedir(), ".config", "rook");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function ensureConfigDir() {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

export function loadConfig(): Config {
	ensureConfigDir();
	if (!existsSync(CONFIG_PATH)) {
		return { connections: [] };
	}
	const raw = readFileSync(CONFIG_PATH, "utf-8");
	return JSON.parse(raw) as Config;
}

export function saveConfig(config: Config) {
	ensureConfigDir();
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function addConnection(conn: Connection) {
	const config = loadConfig();
	config.connections.push(conn);
	saveConfig(config);
}

export function deleteConnection(name: string) {
	const config = loadConfig();
	config.connections = config.connections.filter((c) => c.name !== name);
	saveConfig(config);
}

export function updateConnection(name: string, updates: Partial<Connection>) {
	const config = loadConfig();
	const idx = config.connections.findIndex((c) => c.name === name);
	if (idx >= 0) {
		config.connections[idx] = { ...config.connections[idx], ...updates };
		saveConfig(config);
	}
}
