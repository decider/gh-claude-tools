#!/usr/bin/env node

import { 
  getCurrentBranch,
  hasUncommittedChanges,
  ensureBranchPushed,
  getCurrentPR,
  getPRContext,
  generatePRContent,
  exec,
  execStream,
  chalk,
  isDebug
} from '../lib/helpers';

async function main(): Promise<void> {
  try {
    const branch = await getCurrentBranch();

    // Commit if needed
    if (await hasUncommittedChanges()) {
      console.log(chalk.yellow('📝 Uncommitted changes detected...'));
      const ghcPath = require.resolve('./ghc');
      const ghcResult = await execStream(`node "${ghcPath}"`, { throwOnError: false });
      if (!ghcResult) {
        process.exit(1);
      }
    }

    // Push with tracking
    try {
      await ensureBranchPushed();
      console.log(chalk.green(`✓ Pushed to origin/${branch}`));
    } catch (error) {
      console.log(chalk.red('✗ Push failed'));
      if (error instanceof Error && isDebug) {
        console.log(chalk.gray(`Error details: ${error.message}`));
      }
      process.exit(1);
    }

    // Check existing PR
    const existingPR = await getCurrentPR();

    if (existingPR) {
      console.log(chalk.green(`✓ PR already exists: ${existingPR}`));
      console.log(chalk.yellow('⏳ Auto-updating PR description...'));
      
      const context = await getPRContext();
      const prContent = await generatePRContent(context);
      const description = prContent.split('\n').slice(2).join('\n');
      
      // Use temp file for PR edit to avoid escaping issues
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const tmpFile = path.join(os.tmpdir(), `pr-edit-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, description);
      
      await exec(`gh pr edit --body-file "${tmpFile}"`);
      fs.unlinkSync(tmpFile);
      console.log(chalk.green('✓ PR description updated'));
    } else {
      // Create new PR
      console.log(chalk.yellow('⏳ Creating new PR...'));
      console.log(chalk.yellow('⏳ Generating PR title and description...'));
      
      const context = await getPRContext();
      const prContent = await generatePRContent(context);
      const lines = prContent.split('\n');
      const title = lines[0];
      const body = lines.slice(2).join('\n');
      
      // Create PR using temporary file for body to avoid shell escaping issues
      try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        
        // Write PR body to temporary file
        const tmpFile = path.join(os.tmpdir(), `pr-body-${Date.now()}.md`);
        fs.writeFileSync(tmpFile, body);
        
        if (isDebug) {
          console.log(chalk.gray(`📝 Creating PR with title: ${title}`));
        }
        // Escape title for shell command
        const escapedTitle = title.replace(/"/g, '\\"');
        const prOutput = await exec(`gh pr create --title "${escapedTitle}" --body-file "${tmpFile}" --base main --head "${branch}"`);
        
        // Clean up temp file
        fs.unlinkSync(tmpFile);
        
        const prUrl = prOutput?.match(/https:\/\/[^\s]+/)?.[0];
        if (prUrl) {
          console.log(chalk.green(`✓ PR created: ${prUrl}`));
        }
      } catch (error) {
        console.log(chalk.red('✗ Failed to create PR'));
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
    process.exit(1);
  }
}

main();