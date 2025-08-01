#!/usr/bin/env node

import { 
  getCurrentBranch,
  ensureBranchPushed,
  getCurrentPR,
  execStream,
  chalk 
} from '../lib/helpers';

async function main(): Promise<void> {
  try {
    console.log(chalk.blue('🚀 Starting commit and push workflow...'));
    
    // Commit
    const ghcPath = require.resolve('./ghc');
    const ghcResult = await execStream(`node "${ghcPath}"`, { throwOnError: false });
    if (!ghcResult) {
      process.exit(1);
    }

    // Push
    const branch = await getCurrentBranch();
    try {
      await ensureBranchPushed();
      console.log(chalk.green(`✓ Pushed to origin/${branch}`));
    } catch (error) {
      console.log(chalk.red('✗ Push failed'));
      process.exit(1);
    }

    // Show PR status
    const prUrl = await getCurrentPR();
    if (prUrl) {
      console.log(chalk.blue(`📎 PR: ${prUrl}`));
    } else {
      console.log(chalk.yellow('💡 No PR yet. Run \'ghp\' to create one.'));
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

main();