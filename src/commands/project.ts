import { log } from "../utils/logger";
import {
  loadProjectConfig,
  saveProjectConfig,
  projectConfigExists,
  type ProjectConfig,
} from "../utils/config";
import { PROJECT_CONFIG_FILE, getCurrentVersionLink } from "../utils/paths";
import { getCurrentVersion } from "./version";
import { basename } from "path";

// Initialize a new Odin project
export async function initProject(name?: string): Promise<void> {
  const cwd = process.cwd();
  const projectName = name || basename(cwd);

  // Check if already initialized
  if (await projectConfigExists(cwd)) {
    throw new Error(`Project already initialized. See ${PROJECT_CONFIG_FILE}`);
  }

  log.header(`Creating new Odin project: ${projectName}`);

  // Get current Odin version if available
  const currentVersion = await getCurrentVersion();

  const config: ProjectConfig = {
    $schema:
      "https://raw.githubusercontent.com/biswas08433/opm/main/schema/opm.schema.json",
    name: projectName,
    version: "0.1.0",
    description: "",
    author: "",
    license: "MIT",
    odinVersion: currentVersion || undefined,
    collections: {},
    dependencies: {},
    devDependencies: {},
    scripts: {
      build: "odin build src -out:bin/${name}",
      run: "odin run src",
      test: "odin test tests",
      check: "odin check src",
    },
    build: {
      src: "src",
      out: "bin",
      flags: [],
    },
  };

  // Save project config
  await saveProjectConfig(config, cwd);

  // Create directory structure
  await Bun.$`mkdir -p src bin tests`.quiet();

  // Create a basic main.odin file
  const mainFile = Bun.file(`${cwd}/src/main.odin`);
  if (!(await mainFile.exists())) {
    await Bun.write(
      mainFile,
      `package main

import "core:fmt"

main :: proc() {
    fmt.println("Hello, ${projectName}!")
}
`,
    );
  }

  // Create .gitignore
  const gitignore = Bun.file(`${cwd}/.gitignore`);
  if (!(await gitignore.exists())) {
    await Bun.write(
      gitignore,
      `# Build output
bin/
*.o
*.obj
*.exe

# Odin packages
odin_packages/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
`,
    );
  }

  log.success(`Created ${PROJECT_CONFIG_FILE}`);
  log.success("Created project structure");

  console.log();
  log.info("Project structure:");
  console.log("  ├── src/");
  console.log("  │   └── main.odin");
  console.log("  ├── bin/");
  console.log("  ├── tests/");
  console.log("  ├── .gitignore");
  console.log(`  └── ${PROJECT_CONFIG_FILE}`);

  console.log();
  log.info("Get started:");
  console.log("  opm run        # Run the project");
  console.log("  opm build      # Build the project");
  console.log("  opm add <pkg>  # Add a dependency");
}

// Show project info
export async function showProject(): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(
      `No ${PROJECT_CONFIG_FILE} found. Run 'opm init' to create one.`,
    );
  }

  log.header(`Project: ${config.name}`);

  log.table([
    ["Name", config.name],
    ["Version", config.version],
    ["Description", config.description || "(none)"],
    ["Author", config.author || "(none)"],
    ["License", config.license || "(none)"],
    ["Odin Version", config.odinVersion || "(any)"],
  ]);

  if (config.dependencies && Object.keys(config.dependencies).length > 0) {
    console.log();
    log.info("Dependencies:");
    log.table(Object.entries(config.dependencies));
  }

  if (
    config.devDependencies &&
    Object.keys(config.devDependencies).length > 0
  ) {
    console.log();
    log.info("Dev Dependencies:");
    log.table(Object.entries(config.devDependencies));
  }

  if (config.scripts && Object.keys(config.scripts).length > 0) {
    console.log();
    log.info("Scripts:");
    log.table(Object.entries(config.scripts));
  }
}

// Run a project script
export async function runScript(
  scriptName: string,
  args: string[] = [],
): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(
      `No ${PROJECT_CONFIG_FILE} found. Run 'opm init' to create one.`,
    );
  }

  // Look for script in config
  const script = config.scripts?.[scriptName];

  if (!script) {
    throw new Error(
      `Script '${scriptName}' not found in ${PROJECT_CONFIG_FILE}`,
    );
  }

  const variables: Record<string, string> = {
    name: config.name,
    version: config.version,
    src: config.build?.src || "src",
    out: config.build?.out || "bin",
  };

  let command = script;
  for (const [key, value] of Object.entries(variables)) {
    command = command.replaceAll(`\${${key}}`, value);
  }

  log.info(`Running script: ${scriptName}`);
  log.dim(`  ${command}`);
  console.log();

  // Append extra args if provided
  const fullCommand =
    args.length > 0 ? `${command} ${args.join(" ")}` : command;

  // Run the script
  const result = await Bun.$`bash -c ${fullCommand}`
    .env({ ...process.env })
    .nothrow();

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

// Clean build artifacts
export async function cleanProject(): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(`No ${PROJECT_CONFIG_FILE} found.`);
  }

  const outDir = config.build?.out || "bin";

  const spinner = log.spinner("Cleaning build artifacts...");
  await Bun.$`rm -rf ${outDir}/*`.quiet().nothrow();
  spinner.stop();

  log.success("Cleaned build artifacts");
}
