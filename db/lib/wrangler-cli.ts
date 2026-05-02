import { execFile } from "node:child_process";
import { promisify } from "node:util";

// `execFile` takes an argv array and never invokes a shell, so user-provided
// arg values are not interpreted by the shell. We additionally validate the
// D1 binding against a strict whitelist as defense-in-depth.
let execFileAsync = promisify(execFile);

// Matches wrangler's own binding naming rules: letters, digits, underscore,
// must start with a letter or underscore. This prevents `--flag`-shaped
// bindings from being mistaken for CLI options at wrangler parse time.
const BINDING_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type ApplyTarget = "remote" | "local";

export interface ApplyCommand {
    /** Executable name or path. Passed to `execFile`, never a shell. */
    file: string;
    /** Args array. Passed to `execFile`, never a shell. */
    args: string[];
}

/** Build the argv for `wrangler d1 migrations apply <db> --remote|--local`. */
export function buildApplyCommand(input: {
    d1Binding: string;
    target: ApplyTarget;
    configPath?: string;
}): ApplyCommand {
    if (!BINDING_PATTERN.test(input.d1Binding)) {
        throw new Error(`invalid D1 binding name: ${JSON.stringify(input.d1Binding)}`);
    }
    let args = ["d1", "migrations", "apply", input.d1Binding, "--" + input.target];
    if (input.configPath) {
        args.push("--config", input.configPath);
    }
    return { file: "wrangler", args };
}

/**
 * Execute a prepared apply command.
 *
 * Resolves `wrangler` through the caller's `PATH`/`node_modules/.bin`. In a
 * non-TTY context wrangler skips the interactive confirmation prompt.
 */
export async function runApplyCommand(
    cmd: ApplyCommand,
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; stderr: string }> {
    let result = await execFileAsync(cmd.file, cmd.args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout: result.stdout, stderr: result.stderr };
}
