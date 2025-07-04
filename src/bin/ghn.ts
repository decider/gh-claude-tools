#!/usr/bin/env node

import { exec, chalk } from '../lib/helpers';

async function main(): Promise<void> {
  const branchName = process.argv[2];
  
  if (!branchName) {
    console.error(chalk.red('Usage: ghn <branch-name>'));
    process.exit(1);
  }

  try {
    console.log(chalk.yellow(`⏳ Creating new branch '${branchName}' from origin/main...`));
    
    // Fetch and create branch
    await exec('git fetch origin');
    await exec(`git checkout -b "${branchName}" origin/main`);
    
    console.log(chalk.green(`✓ Switched to new branch '${branchName}'`));
  } catch (error) {
    console.log(chalk.red('✗ Failed to create branch'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

main();