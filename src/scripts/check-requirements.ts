#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface CommandCheck {
  command: string;
  name: string;
  installInstructions: string;
}

async function checkCommand(command: string, name: string, installInstructions: string): Promise<boolean> {
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

async function main(): Promise<void> {
  console.log(chalk.blue('\nChecking gh-claude-tools requirements...\n'));
  
  let allGood = true;

  const checks: CommandCheck[] = [
    {
      command: 'git',
      name: 'Git',
      installInstructions: 'Install from: https://git-scm.com/downloads'
    },
    {
      command: 'gh',
      name: 'GitHub CLI',
      installInstructions: 'Install with: brew install gh (macOS) or see https://cli.github.com/'
    },
    {
      command: 'claude',
      name: 'Claude CLI',
      installInstructions: 'Install with: npm install -g @anthropic-ai/claude-cli'
    }
  ];

  for (const check of checks) {
    allGood = allGood && await checkCommand(check.command, check.name, check.installInstructions);
  }

  console.log('');
  
  if (allGood) {
    console.log(chalk.green('✅ All requirements are installed!'));
    console.log(chalk.gray('\nYou can now use: ghc, ghp, ghpa, ghn, ghcp'));
  } else {
    console.log(chalk.yellow('⚠️  Some requirements are missing. Please install them before using gh-claude-tools.'));
  }
}

main().catch(console.error);