# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that automatically assigns reviewers to Pull Requests using a lottery system. The action reads configuration from `.github/reviewer-lottery.yml` and assigns reviewers based on flexible selection rules.

## Directory Structure

```
src/
├── main.ts                   # GitHub Action entry point
├── lottery.ts               # Main lottery logic and orchestration
├── config.ts                # Configuration parsing and validation
├── interfaces.ts            # Service contracts and interfaces
├── actions-service.ts       # GitHub Actions logging service
├── github-service.ts        # GitHub API service implementation
├── config-test.ts           # CLI tool for configuration testing
├── core/
│   └── reviewer-selector.ts # Core reviewer selection logic
└── types/
    └── selection-types.ts   # Selection-specific type definitions

__tests__/
├── unit/
│   └── lottery.test.ts      # Unit tests for lottery logic
├── integration/
│   └── lottery-github-api.test.ts # Integration tests
├── mocks.ts                 # Test mocks and stubs
└── test-helpers.ts          # Test utility functions

examples/
├── sample-config.yml        # Basic configuration example
├── advanced-selection-patterns.yml
├── complex-group-patterns.yml
└── organizational-hierarchy.yml

bin/                         # CLI executables
action.yml                   # GitHub Action definition
tsconfig.json               # TypeScript configuration
tsup.config.ts              # Build configuration
jest.config.js              # Test configuration
biome.json                  # Linting/formatting configuration
```

## Core Architecture

### Main Components

- **src/main.ts**: Entry point that extracts PR information from GitHub Actions context and orchestrates the lottery process
- **src/lottery.ts**: Core lottery logic containing the `Lottery` class that handles reviewer selection and GitHub API interactions
- **src/config.ts**: Configuration parsing and validation, loads YAML config from `.github/reviewer-lottery.yml`
- **src/interfaces.ts**: TypeScript interfaces for all service contracts and data structures
- **src/actions-service.ts**: Service implementations for GitHub Actions logging and outputs
- **src/github-service.ts**: Service implementation for GitHub API interactions
- **src/core/reviewer-selector.ts**: Core reviewer selection logic with sophisticated rule handling
- **src/config-test.ts**: CLI tool for testing configuration files locally

### Key Classes

- **Lottery**: Main class that manages the reviewer selection process
  - Uses dependency injection for all external services
  - Implements complex selection rules (by author group, fallback rules, etc.)
  - Manages exclusion logic (author, existing reviewers, selected reviewers)
  - Provides comprehensive logging and GitHub Action outputs
- **ReviewerSelector**: Core selection logic extracted from Lottery class
  - Handles multiple group membership strategies ("merge" vs "first")
  - Implements special selector patterns (`"*"`, `"!groupname"`)
  - Returns detailed selection results with applied rules and process steps

### Service Layer

- **GitHubServiceImpl**: Handles all GitHub API interactions
  - Get PR information, existing reviewers, and PR authors
  - Set reviewers on pull requests
  - Find PRs by Git reference
- **LoggerImpl**: Wraps GitHub Actions core logging with structured output
- **ActionOutputsImpl**: Manages GitHub Actions outputs and job summaries

### Selection Rules Architecture

The action supports sophisticated selection rules:
- **default**: Fallback rules for any author
- **by_author_group**: Rules specific to authors in particular groups
- **non_group_members**: Rules for authors not in any group
- Special selectors: 
  - `"*"` (all groups)
  - `"!groupname"` (exclude specific group)
  - `"!group1,group2"` (exclude multiple groups, comma-separated)

## Development Commands

```bash
# Install dependencies
pnpm install

# Type checking without output
pnpm typecheck

# Run tests
pnpm test

# Run single test by pattern
pnpm test -- --testNamePattern="test name"

# Format code
pnpm format

# Check formatting
pnpm format-check

# Lint code
pnpm lint

# Fix linting issues
pnpm lint-fix

# Build distribution bundle (creates dist/index.js)
pnpm pack

# Test configuration locally
npx github:fan-k-tamura/reviewer-lottery config-test
# Alternative: npx tsx bin/config-test.js

# Run all checks (typecheck, format, lint, pack, test)
pnpm all
```

## Testing

- Uses Jest with ts-jest for TypeScript support
- Tests are in `__tests__/` directory
- Run single test: `pnpm test -- --testNamePattern="test name"`
- Coverage reports generated in `coverage/` directory

## Code Style

- Uses Biome for formatting and linting
- Space indentation (2 spaces), double quotes
- Strict TypeScript configuration
- Organized imports enabled

## Configuration

The action expects a YAML configuration file at `.github/reviewer-lottery.yml` (or custom path via `config` input) with:
- `groups`: Array of team definitions with names and usernames
- `selection_rules`: Complex rules for reviewer assignment based on author group membership
  - `default`: Fallback rules for any author
  - `by_author_group`: Rules specific to authors in particular groups
  - `non_group_members`: Rules for authors not in any group
- `when_author_in_multiple_groups`: Strategy for handling multiple group membership ("merge" or "first", default: "merge")

### Configuration Testing

Use the built-in config tester to validate your configuration:
```bash
npx github:fan-k-tamura/reviewer-lottery config-test
```

This CLI tool will:
- Load and validate your configuration
- Generate test scenarios based on your groups
- Show detailed selection results for each scenario
- Provide statistics on reviewer distribution

### When No Reviewers Are Added

The action will not add reviewers in these cases:
1. PR author is the only member of all selected groups
2. All potential reviewers are already assigned to the PR
3. No matching selection rules for the author
4. All groups in selection rules have 0 reviewers requested

## GitHub Action Integration

- Current version: `@v4`
- Runs on Node.js 20
- Main entry point: `dist/index.js` (built from TypeScript source)
- **Required inputs**:
  - `repo-token`: GitHub token (usually `${{ secrets.GITHUB_TOKEN }}`)
- **Optional inputs**:
  - `config`: Path to config file (defaults to `.github/reviewer-lottery.yml`)
  - `pr-author`: PR author username (auto-detected if not provided)

### Excluding Bot PRs

To exclude bot-authored PRs from the lottery:
```yaml
jobs:
  assign-reviewer:
    if: ${{ !endsWith(github.event.pull_request.user.login, '[bot]') }}
    runs-on: ubuntu-latest
    steps:
      - uses: fan-k-tamura/reviewer-lottery@v4
```

## Commit Style

This project uses **Conventional Commits** for commit messages. Follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Common Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, build changes

### Examples
```
feat: add support for excluding bot PRs from lottery
fix: prevent infinite loop in pickRandom when candidates insufficient
test: enhance test coverage and add TDD best practices
docs: update README with new configuration options
refactor: extract reviewer selection logic into separate methods
chore: update dependencies and build configuration
```

## Configuration Examples

### Basic Example
```yaml
groups:
  - name: team
    usernames:
      - alice
      - bob
      - charlie
      - diana

selection_rules:
  default:
    from:
      team: 2  # Always assign 2 reviewers from the team
```

### Advanced Example with Multiple Groups
```yaml
groups:
  - name: backend
    usernames: [alice, bob, charlie]
  - name: frontend
    usernames: [diana, eve]
  - name: ops
    usernames: [frank, grace]

selection_rules:
  # Default rules for any author
  default:
    from:
      backend: 1
      frontend: 2

  # Rules for non-group members
  non_group_members:
    from:
      backend: 1
      ops: 1

  # Group-specific rules
  by_author_group:
    - group: backend
      from:
        backend: 2    # Same team review
        frontend: 1   # Cross-team review

    - group: frontend
      from:
        "*": 2        # From any group

    - group: ops
      from:
        ops: 2
        "!ops": 1     # From any team except ops
        
    # Example with multiple group exclusion
    - group: backend
      from:
        backend: 1
        "!ops,security": 2  # From any team except ops and security

# Control multiple group membership behavior
when_author_in_multiple_groups: merge  # or "first"
```

## Key Dependencies

- `@actions/core`: GitHub Actions SDK for inputs/outputs/logging
- `@actions/github`: GitHub API client and context handling
- `js-yaml`: YAML parsing for configuration
- `tsup`: Modern TypeScript bundler (replaces deprecated `@vercel/ncc`)

## Build Process

### Development Build
- **TypeScript compilation**: `tsc` compiles to `lib/` directory
- **Target**: ES6 with CommonJS modules for Node.js compatibility

### Distribution Build
- **Bundler**: `tsup` creates single minified `dist/index.js` file
- **Configuration**: `tsup.config.ts`
- **Target**: Node.js 20
- **Features**: Bundled, minified, all dependencies included

## Configuration Examples

### Basic Example
```yaml
groups:
  - name: team-a
    usernames:
      - alice
      - bob
      - charlie

selection_rules:
  default:
    from:
      team-a: 2
```

### Advanced Example
```yaml
groups:
  - name: frontend
    usernames: [alice, bob, charlie]
  - name: backend
    usernames: [david, eve, alice]  # alice is in both groups
  - name: ops
    usernames: [frank, grace]
  - name: security
    usernames: [henry, ivan]

selection_rules:
  # Default rule for any author
  default:
    from:
      frontend: 1
      backend: 1
  
  # Rules for authors in specific groups
  by_author_group:
    - group: frontend
      from:
        backend: 2    # frontend authors get backend reviewers
    - group: backend
      from:
        frontend: 2   # backend authors get frontend reviewers
    - group: ops
      from:
        "*": 1        # ops authors get 1 reviewer from any group
        "!ops,security": 0  # but not from ops or security groups
  
  # Rules for authors not in any defined group
  non_group_members:
    from:
      "*": 2          # external contributors get 2 reviewers from any group

# How to handle authors in multiple groups
when_author_in_multiple_groups: merge  # or "first"
```
