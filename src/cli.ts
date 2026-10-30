// Entry point for the `wemora` CLI. Placeholder until the commands are implemented (docs/tasks/a.md, A11 and A18).
const [command] = process.argv.slice(2)

console.error(`wemora${command ? ` ${command}` : ""}: not implemented yet`)
process.exitCode = 1
