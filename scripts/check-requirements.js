#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const chalk = require('chalk');

async function checkCommand(command, name, installInstructions) {
  try {
    await execAsync(`which ${command}`);
    console.log(chalk.green(`✓ ${name} is installed`));
    return true;
  } catch {
    console.log(chalk.red(`✗ ${name} is not installed`));
    console.log(chalk.yellow(`  ${installInstructions}`));
    return false;
  }
}

async function main() {
  console.log(chalk.blue('\nChecking gh-claude-tools requirements...\n'));
  
  let allGood = true;

  // Check Git
  allGood &= await checkCommand('git', 'Git', 'Install from: https://git-scm.com/downloads');
  
  // Check GitHub CLI
  allGood &= await checkCommand('gh', 'GitHub CLI', 'Install with: brew install gh (macOS) or see https://cli.github.com/');
  
  // Check Claude CLI
  allGood &= await checkCommand('claude', 'Claude CLI', 'Install with: npm install -g @anthropic-ai/claude-cli');

  console.log('');
  
  if (allGood) {
    console.log(chalk.green('✅ All requirements are installed!'));
    console.log(chalk.gray('\nYou can now use: ghc, ghp, ghpa, ghn, ghcp'));
  } else {
    console.log(chalk.yellow('⚠️  Some requirements are missing. Please install them before using gh-claude-tools.'));
  }
}

main().catch(console.error);