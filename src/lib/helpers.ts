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
  
  console.log(chalk.gray(`🔧 Auth method: ${auth.method}`));
  console.log(chalk.gray(`⚡ Calling Claude CLI...`));
  
  if (auth.method === 'claude-cli') {
    // Use claude CLI directly
    try {
      const result = await execa.command(`claude --print "${prompt}"`, {
        shell: true,
        input: input,
        timeout: 90000
      });
      console.log(chalk.gray(`✅ Claude CLI responded`));
      console.log(chalk.gray(`📤 Response length: ${result.stdout.length} chars`));
      const trimmed = result.stdout.trim();
      console.log(chalk.gray(`🔄 Returning to caller...`));
      return trimmed;
    } catch (error: any) {
      console.log(chalk.gray(`❌ Claude CLI failed: ${error.message}`));
      if (error.timedOut) {
        throw new Error('Claude CLI timed out after 90 seconds. The diff may be too large or Claude API is slow.');
      }
      throw error;
    }
  } else {
    // Use API directly with the key
    const env = auth.key ? { ANTHROPIC_API_KEY: auth.key } : {};
    
    // First check if claude CLI is available
    try {
      const result = await execa.command(`claude --print "${prompt}"`, {
        shell: true,
        input: input,
        timeout: 90000,
        env: { ...process.env, ...env }
      });
      console.log(chalk.gray(`✅ Claude CLI responded`));
      console.log(chalk.gray(`📤 Response length: ${result.stdout.length} chars`));
      const trimmed = result.stdout.trim();
      console.log(chalk.gray(`🔄 Returning to caller...`));
      return trimmed;
    } catch (error: any) {
      console.log(chalk.gray(`❌ Claude CLI failed: ${error.message}`));
      if (error.timedOut) {
        throw new Error('Claude CLI timed out after 90 seconds. The diff may be too large or Claude API is slow.');
      }
      if (error.exitCode) {
        // If claude CLI not available, we'd need to use the API directly
        // For now, we'll require claude CLI to be installed
        console.error(chalk.red('\n✗ Claude CLI is required but not found'));
        console.error(chalk.yellow('Install with: npm install -g @anthropic-ai/claude-cli\n'));
        throw new Error('Claude CLI not found');
      }
      throw error;
    }
  }
}

/**
 * Limit diff size for commit message generation
 */
function limitDiffForCommit(diff: string): string {
  const maxChars = 15000;
  
  if (diff.length <= maxChars) {
    return diff;
  }
  
  // For large diffs, prioritize file changes over content
  const lines = diff.split('\n');
  const fileHeaders = lines.filter(line => line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---'));
  const changeLines = lines.filter(line => line.startsWith('+') || line.startsWith('-'));
  
  // Include file headers and first N change lines
  const limitedLines = [...fileHeaders, ...changeLines.slice(0, 200)];
  const limitedDiff = limitedLines.join('\n');
  
  if (limitedDiff.length <= maxChars) {
    return limitedDiff;
  }
  
  // If still too long, just use the first maxChars characters
  return diff.substring(0, maxChars) + '\n\n[diff truncated due to size]';
}

/**
 * Generate commit message using Claude
 */
export async function generateCommitMessage(diff: string): Promise<string> {
  const prompt = `Write a conventional commit message for these changes. Format: <type>: <description>. Keep under 72 chars. Use types: feat/fix/docs/style/refactor/test/chore. Output ONLY the commit message, no explanation.`;
  
  try {
    const limitedDiff = limitDiffForCommit(diff);
    return await executeClaudeCommand(prompt, limitedDiff);
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
    console.log(chalk.gray(`📊 Context size: ${context.length} characters`));
    const result = await executeClaudeCommand(prompt, context);
    console.log(chalk.gray(`✨ PR content generated successfully`));
    return result;
  } catch (error) {
    console.error(chalk.red('✗ Failed to generate PR content with Claude'));
    if (error instanceof Error) {
      console.error(chalk.gray(`Error details: ${error.message}`));
    }
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
 * Limit diff size for PR description generation
 */
function limitDiffForPR(diff: string): string {
  const maxChars = 30000;
  
  if (diff.length <= maxChars) {
    return diff;
  }
  
  console.log(chalk.gray(`📝 Diff too large (${diff.length} chars), truncating to ${maxChars} chars`));
  
  // For very large diffs, use simple truncation to avoid complexity
  if (diff.length > 100000) {
    console.log(chalk.gray('🔪 Using simple truncation for very large diff'));
    return diff.substring(0, maxChars) + '\n\n[Diff truncated - PR contains additional changes]';
  }
  
  // For moderately large diffs, use structured approach
  const lines = diff.split('\n');
  const fileHeaders = lines.filter(line => 
    line.startsWith('diff --git') || 
    line.startsWith('+++') || 
    line.startsWith('---') ||
    line.startsWith('index ')
  );
  
  // Get a sample of changes from each file
  const changesByFile: { [key: string]: string[] } = {};
  let currentFile = '';
  
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      currentFile = line;
      changesByFile[currentFile] = [];
    } else if (currentFile && (line.startsWith('+') || line.startsWith('-'))) {
      if (!changesByFile[currentFile]) {
        changesByFile[currentFile] = [];
      }
      if (changesByFile[currentFile].length < 20) { // Limit lines per file
        changesByFile[currentFile].push(line);
      }
    }
  }
  
  // Build the limited diff
  let limitedDiff = fileHeaders.join('\n') + '\n\n';
  let currentLength = limitedDiff.length;
  
  for (const [file, changes] of Object.entries(changesByFile)) {
    const section = `\n${file}\n${changes.join('\n')}\n`;
    if (currentLength + section.length > maxChars) {
      break;
    }
    limitedDiff += section;
    currentLength += section.length;
  }
  
  console.log(chalk.gray(`✂️ Truncated diff to ${limitedDiff.length} chars`));
  return limitedDiff + '\n\n[Diff truncated - PR contains additional changes]';
}

/**
 * Get PR context for Claude
 */
export async function getPRContext(): Promise<string> {
  const diffStat = await exec('git diff origin/main...HEAD --stat') || '';
  const commits = await exec('git log origin/main..HEAD --oneline') || '';
  const fullDiff = await exec('git diff origin/main...HEAD') || '';
  
  const limitedDiff = limitDiffForPR(fullDiff);
  
  return `Diff summary:\n${diffStat}\n\nCommits:\n${commits}\n\nSample changes:\n${limitedDiff}`;
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