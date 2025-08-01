#!/usr/bin/env node

import { exec, execStream, chalk } from '../lib/helpers';

async function main(): Promise<void> {
  try {
    console.log(chalk.blue('🚀 Creating PR with auto-merge...'));
    
    // Use ghp to handle commit/push/PR creation
    const ghpPath = require.resolve('./ghp');
    const ghpResult = await execStream(`node "${ghpPath}"`, { throwOnError: false });
    if (!ghpResult) {
      process.exit(1);
    }

    // Enable auto-merge
    console.log(chalk.yellow('⏳ Enabling auto-merge...'));
    try {
      await exec('gh pr merge --auto --squash');
      console.log(chalk.green('✓ Auto-merge enabled'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not enable auto-merge (may already be enabled or checks pending)'));
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

main();