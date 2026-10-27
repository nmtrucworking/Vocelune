import { spawn } from 'node:child_process';
const commands = [['run', 'dev:frontend'], ['run', 'dev:backend'], ['run', 'worker']];
const children = commands.map(args => spawn('npm', args, { stdio: 'inherit', cwd: new URL('..', import.meta.url) }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) child.on('exit', code => stop(code || 0));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
