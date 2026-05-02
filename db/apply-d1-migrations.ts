import { parseArgs } from "node:util";
import { assert } from "remix/assert";

import { buildApplyCommand, runApplyCommand } from "./lib/wrangler-cli.ts";
import { parseWranglerConfig } from "./lib/wrangler-config.ts";

// CLI: `node db/apply-d1-migrations.ts [--local|--remote]`. Defaults to remote.
let { values } = parseArgs({
    options: {
        local: { type: "boolean", default: false },
        remote: { type: "boolean", default: false },
    },
});

if (values.local && values.remote) {
    console.error("Error: choose either --local or --remote, not both.");
    process.exit(1);
}

let target: "local" | "remote" = values.local ? "local" : "remote";

if (target === "remote") {
    assert(
        process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY,
        "Error: CLOUDFLARE_API_TOKEN (or CLOUDFLARE_API_KEY) is required for --remote apply.",
    );
}

let config = parseWranglerConfig();
let cmd = buildApplyCommand({
    d1Binding: config.d1.binding,
    target,
    configPath: config.configPath,
});

console.log(`$ ${cmd.file} ${cmd.args.join(" ")}`);
try {
    let { stdout, stderr } = await runApplyCommand(cmd);
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
} catch (error) {
    let err = error as { stdout?: string; stderr?: string; message?: string };
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    console.error(err.message ?? String(error));
    process.exit(1);
}
