import * as execa from 'execa';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { AuthResult, ExecOptions } from './types';

/**
 * Execute a shell command and return the result
 */
export async function exec(command: string, options: ExecOptions = {}): Promise<string | null> {
  try {
    const result = await execa.command(command, { shell: true, ...options });
    return result.stdout;
  } catch (error) {
    if (options.throwOnError !== false) {
      throw error;
    }
    return null;
  }
}

/**
 * Execute a command and stream output to console
 */
export async function execStream(command: string, options: ExecOptions = {}): Promise<boolean> {
  try {
    await execa.command(command, { shell: true, stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    if (options.throwOnError !== false) {
      throw error;
    }
    return false;
  }
}

/**
 * Get the current git branch
 */
export async function getCurrentBranch(): Promise<string> {
  const branch = await exec('git branch --show-current');
  if (!branch) {
    throw new Error('Failed to get current branch');
  }
  return branch;
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(): Promise<boolean> {
  const unstaged = await exec('git diff --name-only', { throwOnError: false });
  const staged = await exec('git diff --cached --name-only', { throwOnError: false });
  const untracked = await exec('git ls-files --others --exclude-standard', { throwOnError: false });
  return !!(unstaged || staged || untracked);
}

/**
 * Check if there are staged changes
 */
export async function hasStagedChanges(): Promise<boolean> {
  const staged = await exec('git diff --cached --name-only', { throwOnError: false });
  return !!staged;
}

/**
 * Get or prompt for Anthropic API key
 */
async function getAnthropicApiKey(): Promise<AuthResult> {
  // 1. Check environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return { method: 'env', key: process.env.ANTHROPIC_API_KEY };
  }

  // 2. Check if claude CLI works (already authenticated)
  try {
    await exec('claude --version', { throwOnError: true });
    return { method: 'claude-cli', key: null };
  } catch {
    // Claude CLI not available or not authenticated
  }

  // 3. Check stored config
  const configPath = path.join(os.homedir(), '.gh-claude-tools', 'config.json');
  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    if (config.anthropicApiKey) {
      return { method: 'config', key: config.anthropicApiKey };
    }
  } catch {
    // No config file or no key stored
  }

  // 4. Prompt user for API key
  console.log(chalk.yellow('\n🔑 Anthropic API key required for AI features'));
  console.log(chalk.gray('Get your API key from: https://console.anthropic.com/settings/keys\n'));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const apiKey = await new Promise<string>((resolve) => {
    rl.question('Enter your Anthropic API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!apiKey) {
    throw new Error('API key is required for AI features');
  }

  // Save the API key for future use
  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify({ anthropicApiKey: apiKey }, null, 2));
    await fs.chmod(configPath, 0o600); // Secure file permissions
    console.log(chalk.green('✓ API key saved securely\n'));
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not save API key for future use'));
  }

  return { method: 'prompt', key: apiKey };
}

/**
 * Execute Claude AI command with proper authentication
 */
async function executeClaudeCommand(prompt: string, input: string): Promise<string> {
  const auth = await getAnthropicApiKey();
  
  if (auth.method === 'claude-cli') {
    // Use claude CLI directly
    const result = await execa.command(`claude --print "${prompt}"`, {
      shell: true,
      input: input,
      timeout: 30000
    });
    return result.stdout.trim();
  } else {
    // Use API directly with the key
    const env = auth.key ? { ANTHROPIC_API_KEY: auth.key } : {};
    
    // First check if claude CLI is available
    try {
      const result = await execa.command(`claude --print "${prompt}"`, {
        shell: true,
        input: input,
        timeout: 30000,
        env: { ...process.env, ...env }
      });
      return result.stdout.trim();
    } catch (error) {
      // If claude CLI not available, we'd need to use the API directly
      // For now, we'll require claude CLI to be installed
      console.error(chalk.red('\n✗ Claude CLI is required but not found'));
      console.error(chalk.yellow('Install with: npm install -g @anthropic-ai/claude-cli\n'));
      throw new Error('Claude CLI not found');
    }
  }
}

/**
 * Generate commit message using Claude
 */
export async function generateCommitMessage(diff: string): Promise<string> {
  const prompt = `Write a conventional commit message for these changes. Format: <type>: <description>. Keep under 72 chars. Use types: feat/fix/docs/style/refactor/test/chore. Output ONLY the commit message, no explanation.`;
  
  try {
    return await executeClaudeCommand(prompt, diff);
  } catch (error) {
    console.error(chalk.red('✗ Failed to generate commit message with Claude'));
    throw error;
  }
}

/**
 * Generate PR content using Claude
 */
export async function generatePRContent(context: string): Promise<string> {
  const prompt = `Based on these git changes, write a PR title (first line, under 72 chars) and description. Include: brief summary, key changes as bullets. Format for GitHub markdown. Output ONLY the title on first line, then a blank line, then the description.`;
  
  try {
    return await executeClaudeCommand(prompt, context);
  } catch (error) {
    console.error(chalk.red('✗ Failed to generate PR content with Claude'));
    throw error;
  }
}

/**
 * Ensure branch is pushed and tracked
 */
export async function ensureBranchPushed(): Promise<void> {
  const branch = await getCurrentBranch();
  
  // Check if branch has upstream
  const hasUpstream = await exec(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { throwOnError: false });
  
  if (!hasUpstream) {
    console.log(chalk.yellow('⏳ Setting up branch tracking...'));
    await exec(`git push -u origin ${branch}`);
  } else {
    console.log(chalk.yellow(`⏳ Pushing ${branch} to origin...`));
    await exec('git push');
  }
}

/**
 * Get PR context for Claude
 */
export async function getPRContext(): Promise<string> {
  const diffStat = await exec('git diff origin/main...HEAD --stat') || '';
  const commits = await exec('git log origin/main..HEAD --oneline') || '';
  const diffSample = await exec('git diff origin/main...HEAD | head -300') || '';
  
  return `Diff summary:\n${diffStat}\n\nCommits:\n${commits}\n\nSample changes:\n${diffSample}`;
}

/**
 * Check if PR exists for current branch
 */
export async function getCurrentPR(): Promise<string | null> {
  try {
    const prUrl = await exec('gh pr view --json url -q .url');
    return prUrl || null;
  } catch {
    return null;
  }
}

/**
 * Stage all changes
 */
export async function stageAllChanges(): Promise<void> {
  console.log(chalk.yellow('📝 Staging all changes...'));
  await exec('git add -A');
}

export { chalk };