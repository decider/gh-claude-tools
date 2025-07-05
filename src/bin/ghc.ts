#!/usr/bin/env node

import { 
  hasUncommittedChanges, 
  hasStagedChanges, 
  stageAllChanges,
  generateCommitMessage,
  getCurrentPR,
  exec,
  chalk 
} from '../lib/helpers';

async function main(): Promise<void> {
  try {
    // Check for changes
    if (!(await hasUncommittedChanges())) {
      console.log(chalk.green('✅ No changes to commit'));
      process.exit(0);
    }

    // Stage all changes if none are staged
    if (!(await hasStagedChanges())) {
      await stageAllChanges();
    }

    // Get staged diff
    const diff = await exec('git diff --cached');
    if (!diff) {
      console.log(chalk.red('✗ No staged changes to commit'));
      process.exit(1);
    }

    // Generate and commit
    console.log(chalk.yellow('🤖 Generating commit message...'));
    const commitMsg = await generateCommitMessage(diff);
    console.log(chalk.yellow(`📝 Commit message: ${commitMsg}`));

    try {
      await exec(`git commit -m "${commitMsg}"`);
      console.log(chalk.green('✓ Committed successfully'));

      // Show PR if exists
      const prUrl = await getCurrentPR();
      if (prUrl) {
        console.log(chalk.blue(`📎 PR: ${prUrl}`));
      }
      process.exit(0);
    } catch (error) {
      console.log(chalk.red('✗ Commit failed'));
      if (error instanceof Error) {
        console.log(chalk.red(`\nError details:`));
        console.log(chalk.gray(error.message));
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

main();