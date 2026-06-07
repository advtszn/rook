# Changelog

## Unreleased

### Added
- 3-column Miller columns explorer layout (parent / current / preview)
- Value preview in right column shows key type, TTL, and data
- Inspector preserves explorer position — going back restores focus
- `h`/left from inspector returns to explorer
- Seeded local Redis with sample data across all 5 types
- Remove database field from add connection form (defaults to 0)

### Changed
- Explorer uses 2 columns at root level, 3 when navigated deeper
- Left arrow at root is a no-op (only `q` returns to connections)
- Replaced single-pane tree view with Miller columns navigation

## 0.1.0

### Added
- Connection management (add, delete, persist to `~/.config/rook/config.json`)
- Tree explorer with keyboard navigation (j/k/h/l/gg/G)
- Value inspector for all 5 Redis types (String, Hash, List, Set, Sorted Set)
- SCAN-based key loading (never uses `KEYS *`)
- Search with `/` (case-insensitive filtering)
- TTL display and JSON pretty-printing in inspector
- Error states for connection failures and empty databases
