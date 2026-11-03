# Rook

A terminal UI for exploring Redis, built with [OpenTUI](https://opentui.com) and React.

## Install

### Homebrew

```sh
brew install advtszn/tap/rook
```

### Shell script

```sh
curl -fsSL https://raw.githubusercontent.com/advtszn/rook/main/install.sh | sh
```

## Usage

```sh
rook
```

## Development

```sh
bun install
cd packages/cli
bun dev
```

## Project Structure

```
apps/
  docs/       # Documentation site (fumadocs)
packages/
  cli/        # Terminal UI application
```
