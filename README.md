# gh-claude-tools

GitHub CLI tools powered by Claude AI for intelligent commits, PRs, and automation.

## Features

- **AI-powered commit messages** - Generate conventional commit messages based on your changes
- **Automated PR creation** - Create PRs with AI-generated titles and descriptions
- **Auto-merge support** - Enable auto-merge for your PRs with a single command
- **Branch management** - Quickly create new branches from main
- **Seamless workflow** - Commit, push, and create PRs in one command

## Installation

### Prerequisites

Before installing gh-claude-tools, ensure you have the following installed:

1. **Git** - [Download](https://git-scm.com/downloads)
2. **GitHub CLI** - Install with `brew install gh` (macOS) or see [installation guide](https://cli.github.com/)
3. **Claude CLI** - Install with `npm install -g @anthropic-ai/claude-cli`

### Install from GitHub

```bash
# Install directly from GitHub
npm install -g github:decider/gh-claude-tools

# Or install from a specific branch
npm install -g github:decider/gh-claude-tools#main
```

### Install from Local Repository

```bash
# Clone the repository
git clone https://github.com/decider/gh-claude-tools.git
cd gh-claude-tools

# Install globally
npm install -g .

# Or link for development
npm link
```

The post-install script will verify all prerequisites are installed.

## Usage

### Commands

#### `ghc` - GitHub Commit with Claude
Automatically stage changes and commit with an AI-generated message.

```bash
ghc
```

Features:
- Stages all changes if none are staged
- Generates conventional commit message
- Shows existing PR if one exists

#### `ghp` - GitHub Push with PR
Commit changes, push to remote, and create/update a PR.

```bash
ghp
```

Features:
- Commits uncommitted changes first
- Pushes to remote with tracking
- Creates new PR or updates existing one
- Auto-generates PR title and description

#### `ghpa` - GitHub PR with Auto-merge
Same as `ghp` but also enables auto-merge.

```bash
ghpa
```

Features:
- All features of `ghp`
- Enables squash auto-merge
- Perfect for quick iterations

#### `ghn` - GitHub New Branch
Create a new branch from origin/main.

```bash
ghn feature-branch-name
```

Features:
- Fetches latest from origin
- Creates branch from origin/main
- Switches to new branch

#### `ghcp` - GitHub Commit and Push
Commit and push changes without creating a PR.

```bash
ghcp
```

Features:
- Commits with AI-generated message
- Pushes to remote
- Shows PR status if one exists

### Example Workflow

```bash
# Create a new feature branch
ghn add-new-feature

# Make your changes...
# Then commit, push, and create PR with auto-merge
ghpa

# The PR will be created with AI-generated title and description
# Auto-merge will be enabled for when checks pass
```

## GitHub Actions Integration

gh-claude-tools works great in GitHub Actions workflows:

```yaml
name: Auto PR
on: push

jobs:
  create-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install gh-claude-tools
        run: npm install -g gh-claude-tools
      
      - name: Create PR with auto-merge
        run: ghpa
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
```

## Configuration

### Authentication

gh-claude-tools automatically handles Claude authentication by checking in this order:

1. **Environment Variable**: `ANTHROPIC_API_KEY` 
2. **Claude CLI**: If you have Claude CLI installed and authenticated
3. **Saved Config**: Previous API key saved in `~/.gh-claude-tools/config.json`
4. **Interactive Prompt**: Only asks for API key if none of the above work

### Environment Variables

- `ANTHROPIC_API_KEY` - Your Anthropic API key (optional if using Claude CLI)
- `GITHUB_TOKEN` - GitHub token (automatically set in GitHub Actions)

### Git Configuration

The tools respect your existing Git configuration for:
- Default branch (defaults to `main`)
- Remote name (defaults to `origin`)
- Committer name and email

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Dan Seider

## Acknowledgments

Built with:
- [Claude AI](https://www.anthropic.com/claude) for intelligent content generation
- [GitHub CLI](https://cli.github.com/) for GitHub integration
- [Node.js](https://nodejs.org/) for cross-platform compatibility