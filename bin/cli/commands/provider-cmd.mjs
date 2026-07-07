export function registerProvider(program) {
  program
    .command("provider [subcommand]")
    .description("Manage provider connections (use 'providers' for the full interface)")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(() => {
      console.log(`
  Use \`dragon-router providers\` for the full provider management interface:

    dragon-router providers available   — show provider catalog
    dragon-router providers list        — list configured connections
    dragon-router providers test <name> — test a provider connection
    dragon-router providers test-all    — test all active connections
    dragon-router providers validate    — validate local configuration
`);
    });
}
