import { spawnSync } from "node:child_process";
const result = spawnSync("npm.cmd", ["audit", "--json"], {
  encoding: "utf8",
  shell: true,
});
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.log(result.stderr);
  process.exit(1);
}
for (const [name, v] of Object.entries(report.vulnerabilities ?? {}))
  for (const a of v.via)
    if (typeof a === "object")
      console.log(
        JSON.stringify({
          name,
          severity: a.severity,
          title: a.title,
          range: a.range,
          fix: v.fixAvailable,
        }),
      );
console.log(JSON.stringify(report.metadata?.vulnerabilities));
