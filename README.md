# opm - Odin Package Manager

A CLI tool for managing Odin projects, packages, and compiler versions.

## Features

- 🔧 **Version Management** - Install, switch, and manage multiple Odin compiler versions
- 📦 **Package Management** - Add dependencies from GitHub or local paths
- 🚀 **Project Management** - Initialize, build, run, and test Odin projects
- ⚡ **Fast** - Built with Bun for maximum performance

## Installation

### Prerequisites

- [Bun](https://bun.sh) installed on your system
- Git (for cloning packages)

### Install from source

```bash
git clone https://github.com/your-username/opm.git
cd opm
bun install
bun link
```

### Build standalone binary

```bash
bun run build
# Creates ./opm executable
sudo mv opm /usr/local/bin/
```

## Usage

### Version Management

Manage Odin compiler versions:

```bash
# List available versions
opm versions

# Install a specific version
opm install dev-2024-01
opm install latest

# Switch to an installed version
opm use dev-2024-01

# Show current version
opm current

# Uninstall a version
opm uninstall dev-2024-01
```

After installing, add opm's current version to your PATH:

```bash
export PATH="$HOME/.opm/current:$PATH"
```

### Project Management

Create and manage Odin projects:

```bash
# Initialize a new project
opm init my-project
cd my-project

# Or initialize in current directory
opm init

# Show project info
opm info

# Build the project
opm build

# Run the project
opm run

# Run tests
opm test

# Check for errors
opm check

# Clean build artifacts
opm clean
```

### Package Management

Manage project dependencies:

```bash
# Add a dependency
opm add odin-lang/odin-libs
opm add user/repo@v1.0.0
opm add user/repo#branch

# Add a dev dependency
opm add -D some-dev-tool/repo

# Remove a package
opm remove package-name

# Update packages
opm update           # Update all
opm update pkg-name  # Update specific

# Install all dependencies
opm install

# List installed packages
opm list

# Search for packages
opm search raylib
```

#### Package Specifiers

| Format             | Description                   |
| ------------------ | ----------------------------- |
| `user/repo`        | GitHub repository (shorthand) |
| `user/repo@v1.0.0` | Specific tag                  |
| `user/repo#branch` | Specific branch               |
| `github:user/repo` | Explicit GitHub               |
| `git:https://...`  | Any Git URL                   |
| `path:/local/path` | Local path (symlinked)        |

## Project Configuration

Projects use an `opm.json` file:

```json
{
  "name": "my-project",
  "version": "0.1.0",
  "description": "My Odin project",
  "author": "Your Name",
  "license": "MIT",
  "odinVersion": "dev-2024-01",
  "dependencies": {
    "raylib": "odin-lang/raylib-odin"
  },
  "devDependencies": {},
  "collections": {
    "raylib": "odin_packages/raylib"
  },
  "scripts": {
    "build": "odin build src -out:bin/${name}",
    "run": "odin run src",
    "test": "odin test tests",
    "custom": "echo 'custom script'"
  },
  "build": {
    "src": "src",
    "out": "bin",
    "flags": ["-debug"]
  }
}
```

## Directory Structure

opm stores its data in `~/.opm/`:

```
~/.opm/
├── versions/           # Installed Odin versions
│   ├── dev-2024-01/
│   └── dev-2024-02/
├── current -> versions/dev-2024-01  # Symlink to active version
├── cache/              # Download cache
└── config.json         # Global configuration
```

Projects have this structure:

```
my-project/
├── src/
│   └── main.odin
├── tests/
├── bin/
├── odin_packages/      # Installed dependencies
├── opm.json
└── .gitignore
```

## Commands Reference

| Command                   | Description                  |
| ------------------------- | ---------------------------- |
| `opm versions`            | List available Odin versions |
| `opm install <version>`   | Install Odin version         |
| `opm use <version>`       | Switch to version            |
| `opm uninstall <version>` | Remove version               |
| `opm current`             | Show current version         |
| `opm init [name]`         | Initialize project           |
| `opm info`                | Show project info            |
| `opm build`               | Build project                |
| `opm run`                 | Run project                  |
| `opm test`                | Run tests                    |
| `opm check`               | Check for errors             |
| `opm clean`               | Clean build artifacts        |
| `opm add <pkg>`           | Add dependency               |
| `opm add -D <pkg>`        | Add dev dependency           |
| `opm remove <pkg>`        | Remove dependency            |
| `opm update [pkg]`        | Update dependencies          |
| `opm install`             | Install all dependencies     |
| `opm list`                | List dependencies            |
| `opm search <query>`      | Search packages              |
| `opm help`                | Show help                    |
| `opm --version`           | Show version                 |

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Build binary
bun run build
```

## License

MIT
