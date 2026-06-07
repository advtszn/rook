import Redis from "ioredis";
import type { Connection } from "../types.ts";

let currentClient: Redis | null = null;

export function connectToRedis(conn: Connection): Redis {
	if (currentClient) {
		currentClient.disconnect();
	}
	currentClient = new Redis({
		host: conn.host,
		port: conn.port,
		username: conn.username || "default",
		password: conn.password ?? undefined,
		db: conn.database,
		tls: conn.tls ? {} : undefined,
		connectTimeout: 10000,
		lazyConnect: true,
		retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
	});
	currentClient.on("error", () => {});
	return currentClient;
}

export function getClient(): Redis | null {
	return currentClient;
}

export function disconnectRedis() {
	if (currentClient) {
		currentClient.disconnect();
		currentClient = null;
	}
}

export async function scanKeys(client: Redis): Promise<string[]> {
	const keys: string[] = [];
	let cursor = "0";
	do {
		const [nextCursor, batch] = await client.scan(cursor, "COUNT", 500);
		cursor = nextCursor;
		keys.push(...batch);
	} while (cursor !== "0");
	return keys.sort();
}

export async function getKeyType(client: Redis, key: string): Promise<string> {
	return client.type(key);
}

export async function getKeyTTL(client: Redis, key: string): Promise<number> {
	return client.ttl(key);
}

export async function getKeyValue(
	client: Redis,
	key: string,
): Promise<{ type: string; value: string }> {
	const type = await getKeyType(client, key);

	switch (type) {
		case "string": {
			const val = await client.get(key);
			return { type: "String", value: val ?? "" };
		}
		case "hash": {
			const val = await client.hgetall(key);
			const lines = Object.entries(val)
				.map(([k, v]) => `${k}: ${v}`)
				.join("\n");
			return { type: "Hash", value: lines };
		}
		case "list": {
			const val = await client.lrange(key, 0, 99);
			return {
				type: "List",
				value: val.map((v, i) => `${i}: ${v}`).join("\n"),
			};
		}
		case "set": {
			const val = await client.smembers(key);
			return { type: "Set", value: val.sort().join("\n") };
		}
		case "zset": {
			const val = await client.zrange(key, 0, 99, "WITHSCORES");
			const pairs: string[] = [];
			for (let i = 0; i < val.length; i += 2) {
				pairs.push(`${val[i]} (score: ${val[i + 1]})`);
			}
			return { type: "Sorted Set", value: pairs.join("\n") };
		}
		default:
			return { type, value: "(unsupported type)" };
	}
}

export async function deleteKey(client: Redis, key: string): Promise<number> {
	return client.del(key);
}

export async function deleteNamespace(
	client: Redis,
	prefix: string,
): Promise<number> {
	let deleted = 0;
	let cursor = "0";
	do {
		const [nextCursor, batch] = await client.scan(
			cursor,
			"MATCH",
			`${prefix}:*`,
			"COUNT",
			500,
		);
		cursor = nextCursor;
		if (batch.length > 0) {
			deleted += await client.del(...batch);
		}
	} while (cursor !== "0");
	const exists = await client.exists(prefix);
	if (exists) {
		deleted += await client.del(prefix);
	}
	return deleted;
}

export function formatTTL(ttl: number): string {
	if (ttl === -1) return "none";
	if (ttl === -2) return "expired";
	const hours = Math.floor(ttl / 3600);
	const minutes = Math.floor((ttl % 3600) / 60);
	const seconds = ttl % 60;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}
