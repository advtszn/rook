export interface Connection {
	name: string;
	host: string;
	port: number;
	username?: string;
	password: string | null;
	database: number;
	tls?: boolean;
	autoRefreshInterval?: number | null;
}

export interface Config {
	connections: Connection[];
}

export interface TreeNode {
	key: string;
	fullKey: string;
	children: TreeNode[];
	isLeaf: boolean;
}

export interface ExplorerState {
	path: number[];
	selectedIndex: number;
}

export type Screen =
	| { type: "connections" }
	| { type: "explorer"; connection: Connection; restoreState?: ExplorerState }
	| {
			type: "inspector";
			connection: Connection;
			redisKey: string;
			explorerState: ExplorerState;
	  };
