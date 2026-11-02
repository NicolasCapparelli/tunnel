import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const action = process.argv[2] ?? "dev";
if (!["dev", "build", "check", "test"].includes(action))
  throw new Error("Unknown desktop action");
let result;
if (process.platform === "win32") {
  result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(root, "tools", "desktop.ps1"),
      action,
    ],
    { stdio: "inherit" },
  );
} else {
  const cwd = path.join(root, "apps", "desktop");
  const env = { ...process.env, CARGO_TARGET_DIR: path.join(root, "target") };
  result = ["check", "test"].includes(action)
    ? spawnSync("cargo", [action, "--manifest-path", "src-tauri/Cargo.toml"], {
        cwd,
        env,
        stdio: "inherit",
      })
    : spawnSync(
        "npm",
        [
          "run",
          "tauri",
          "--",
          action,
          ...(action === "build" ? ["--no-bundle"] : []),
        ],
        { cwd, env, stdio: "inherit" },
      );
}
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
