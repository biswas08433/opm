#!/usr/bin/env bun

import { log } from "./utils/logger";

// Version commands
import {
  listVersions,
  installVersion,
  useVersion,
  uninstallVersion,
  showCurrent,
} from "./commands/version";

// Project commands
import {
  initProject,
  showProject,
  runScript,
  cleanProject,
} from "./commands/project";

// Package commands
import {
  addPackage,
  removePackage,
  updatePackage,
  installPackages,
  listPackages,
  searchPackages,
} from "./commands/package";

const VERSION = "0.1.0";

const HELP = `
\x1b[1m\x1b[36mopm\x1b[0m - Odin Package Manager v${VERSION}

\x1b[1mUSAGE\x1b[0m
  opm <command> [options]

\x1b[1mVERSION MANAGEMENT\x1b[0m
  versions, ls              List available Odin versions
  install <version>         Install a specific Odin version
  use <version>             Switch to an installed version
  uninstall <version>       Remove an installed version
  current                   Show current Odin version info

\x1b[1mPROJECT MANAGEMENT\x1b[0m
  init [name]               Initialize a new Odin project
  info                      Show project information
  build                     Build the project
  run                       Run the project
  test                      Run tests
  check                     Check the project for errors
  clean                     Clean build artifacts

\x1b[1mPACKAGE MANAGEMENT\x1b[0m
  add <package>             Add a dependency
  add -D <package>          Add a dev dependency
  remove <package>          Remove a dependency
  update [package]          Update dependencies
  i, install                Install all dependencies
  list                      List installed packages
  search <query>            Search for packages on GitHub

\x1b[1mPACKAGE SPECIFIERS\x1b[0m
  user/repo                 GitHub repository
  user/repo@v1.0.0          Specific tag
  user/repo#branch          Specific branch
  github:user/repo          Explicit GitHub
  git:https://url.git       Git URL
  path:/local/path          Local path

\x1b[1mEXAMPLES\x1b[0m
  opm install latest        Install latest Odin compiler
  opm use dev-2024-01       Switch to a specific version
  opm init my-project       Create a new project
  opm add odin-lang/odin    Add a package
  opm run                   Run the project

\x1b[1mMORE INFO\x1b[0m
  https://github.com/odin-lang/odin
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);

  try {
    switch (command) {
      // Version management
      case "versions":
      case "ls":
        await listVersions();
        break;

      case "install":
        if (rest.length === 0) {
          // Install dependencies if no version specified
          await installPackages();
        } else if (
          rest[0] &&
          (rest[0].startsWith("-") || rest[0].includes("/"))
        ) {
          // Looks like a package, not a version
          await installPackages();
        } else if (rest[0]) {
          await installVersion(rest[0]);
        } else {
          log.error("Please specify a version or package to install");
          process.exit(1);
        }
        break;

      case "i":
        await installPackages();
        break;

      case "use":
        if (!rest[0]) {
          log.error("Please specify a version. Example: opm use dev-2024-01");
          process.exit(1);
        }
        await useVersion(rest[0]);
        break;

      case "uninstall":
        if (!rest[0]) {
          log.error("Please specify a version to uninstall");
          process.exit(1);
        }
        await uninstallVersion(rest[0]);
        break;

      case "current":
        await showCurrent();
        break;

      // Project management
      case "init":
        await initProject(rest[0]);
        break;

      case "info":
        await showProject();
        break;

      case "build":
        await runScript("build", rest);
        break;

      case "run":
        await runScript("run", rest);
        break;

      case "test":
        await runScript("test", rest);
        break;

      case "check":
        await runScript("check", rest);
        break;

      case "clean":
        await cleanProject();
        break;

      // Package management
      case "add": {
        const isDev = rest[0] === "-D" || rest[0] === "--dev";
        const pkg = isDev ? rest[1] : rest[0];
        if (!pkg) {
          log.error("Please specify a package. Example: opm add user/repo");
          process.exit(1);
        }
        await addPackage(pkg, isDev);
        break;
      }

      case "remove":
      case "rm":
        if (!rest[0]) {
          log.error("Please specify a package to remove");
          process.exit(1);
        }
        await removePackage(rest[0]);
        break;

      case "update":
      case "upgrade":
        await updatePackage(rest[0]);
        break;

      case "list":
        await listPackages();
        break;

      case "search":
        if (!rest[0]) {
          log.error("Please specify a search query");
          process.exit(1);
        }
        await searchPackages(rest.join(" "));
        break;

      // Help
      case "help":
      case "-h":
      case "--help":
      case undefined:
        console.log(HELP);
        break;

      case "version":
      case "-v":
      case "--version":
        console.log(`opm v${VERSION}`);
        break;

      default:
        // Try to run as a custom script
        try {
          await runScript(command, rest);
        } catch {
          log.error(`Unknown command: ${command}`);
          console.log("\nRun 'opm help' for usage information.");
          process.exit(1);
        }
    }
  } catch (error: any) {
    log.error(error.message || String(error));
    process.exit(1);
  }
}

main();
