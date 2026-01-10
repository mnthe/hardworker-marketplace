#!/usr/bin/env node
/**
 * session-get.ts - Get session info
 * Usage: session-get.ts --session <ID> [--field phase|goal|options] [--dir] [--file]
 * TypeScript port of session-get.sh
 */
interface CliArgs {
    sessionId?: string;
    field?: string;
    getDir: boolean;
    getFile: boolean;
    help: boolean;
}
declare function parseArgs(argv: string[]): CliArgs;
declare function getFieldValue(obj: any, fieldPath: string): any;
export { parseArgs, getFieldValue };
//# sourceMappingURL=session-get.d.ts.map