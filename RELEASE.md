# Release Process

This document describes the process for releasing new versions of drizzle-docs-generator.

## Overview

The release process is automated using GitHub Actions. It follows this flow:

1. **Create a PR to update the version in package.json**
2. **Merge the PR**
3. **Git tag is automatically created and GitHub Release is published**
4. **Package is automatically published to npm**

## Prerequisites

### npm Token Setup

To publish to npm, you need to set up an `NPM_TOKEN` secret in the repository.

1. Create an access token on [npm](https://www.npmjs.com/)
   - Account Settings → Access Tokens → Generate New Token
   - Token Type: Select "Automation"
2. Add it as `NPM_TOKEN` in GitHub repository Settings → Secrets and variables → Actions

## Release Steps

### 1. Create Version Update PR

To release a new version:

```bash
# Update version (patch example)
npm version patch -m "chore: bump version to %s"

# Or manually update the version in package.json
# Example: "version": "0.1.0" → "version": "0.1.1"

# Create PR
git checkout -b release/v0.1.1
git add package.json
git commit -m "chore: bump version to v0.1.1"
git push origin release/v0.1.1
gh pr create --title "chore: release v0.1.1" --body "Release version 0.1.1"
```

Version types:
- **patch**: Bug fixes (`0.1.0` → `0.1.1`)
- **minor**: New features (backward compatible) (`0.1.0` → `0.2.0`)
- **major**: Breaking changes (`0.1.0` → `1.0.0`)

### 2. Merge the PR

Review and merge the PR into the main branch.

### 3. Automatic Release

When merged to main, the `auto-release.yml` workflow automatically:

1. Detects version changes
2. Runs lint, type check, tests, and build
3. Creates a git tag (e.g., `v0.1.1`)
4. Publishes GitHub Release
   - Uses draft release notes created by Release Drafter if available
   - Otherwise generates release notes using GitHub's auto-generation
5. Publishes package to npm

### 4. Verify Release

- Check that the release is published on [GitHub Releases](https://github.com/rikeda71/drizzle-docs-generator/releases)
- Check that the new version is published on [npm](https://www.npmjs.com/package/drizzle-docs-generator)

## About Release Drafter

This project uses [Release Drafter](https://github.com/release-drafter/release-drafter) to automatically generate and update draft release notes.

### How It Works

- Draft releases are updated every time a PR is merged
- Changes are categorized based on PR titles and labels
- When a version update PR is merged, the draft release content is used as the official release notes

### PR Labels and Categories

Apply appropriate labels to PRs to automatically categorize them in release notes:

- `feature`, `enhancement`: 🚀 Features section
- `fix`, `bugfix`, `bug`: 🐛 Bug Fixes section
- `documentation`, `docs`: 📚 Documentation section
- `chore`, `dependencies`, `refactor`: 🔧 Maintenance section

### Automatic Version Suggestion

Release Drafter suggests versions based on PR labels:

- `major` label → Suggests major version bump
- `minor` label → Suggests minor version bump
- `patch` label → Suggests patch version bump
- No label → Defaults to patch

## Troubleshooting

### npm Publish Failed

1. Verify that `NPM_TOKEN` is correctly configured
2. Check that the package name is available on npm
3. Check GitHub Actions logs for error messages

### Tag Already Exists

To re-release with the same version:

```bash
# Delete local tag
git tag -d v0.1.1

# Delete remote tag
git push origin :refs/tags/v0.1.1

# Delete GitHub Release
gh release delete v0.1.1 --yes
```

Then update package.json and merge again.

## Reference Links

- [GitHub Actions Workflow](./.github/workflows/auto-release.yml)
- [Release Drafter Configuration](./.github/release-drafter.yml)
- [npm Package](https://www.npmjs.com/package/drizzle-docs-generator)
