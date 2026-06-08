import { existsSync, realpathSync, unlinkSync } from "node:fs";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useCallback, useRef, useState } from "react";
import { ConnectionsScreen } from "./screens/connections.tsx";
import { ExplorerScreen } from "./screens/explorer.tsx";
import { InspectorScreen } from "./screens/inspector.tsx";
import type { Screen } from "./types.ts";

if (process.argv.includes("--uninstall")) {
	const binary = realpathSync(process.execPath);
	if (binary.includes("/Cellar/") || binary.includes("/homebrew/")) {
		console.log("rook was installed via Homebrew. Run: brew uninstall rook");
		process.exit(0);
	}
	try {
		unlinkSync(binary);
	} catch {
		const { execSync } = await import("node:child_process");
		execSync(`sudo rm "${binary}"`, { stdio: "inherit" });
	}
	console.log("rook has been uninstalled.");
	process.exit(0);
}

function App() {
	const [screen, setScreen] = useState<Screen>({ type: "connections" });
	const sessionKey = useRef(0);

	const handleNavigate = useCallback((next: Screen) => {
		if (next.type === "explorer") sessionKey.current++;
		setScreen(next);
	}, []);

	switch (screen.type) {
		case "connections":
			return <ConnectionsScreen onNavigate={handleNavigate} />;
		case "explorer":
			return (
				<ExplorerScreen
					key={sessionKey.current}
					connection={screen.connection}
					restoreState={screen.restoreState}
					onNavigate={handleNavigate}
				/>
			);
		case "inspector":
			return (
				<InspectorScreen
					connection={screen.connection}
					redisKey={screen.redisKey}
					explorerState={screen.explorerState}
					onNavigate={handleNavigate}
				/>
			);
	}
}

const renderer = await createCliRenderer({
	exitOnCtrlC: true,
	useMouse: false,
	enableMouseMovement: false,
});
createRoot(renderer).render(<App />);
