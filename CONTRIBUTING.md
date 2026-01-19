# Contributing to opm

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/opm.git`
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b feature/your-feature`

### Quick Start Commands

```shell
# 1. Always start from updated main
git checkout main && git pull

# 2. Create feature branch
git checkout -b feature/awesome-thing

# 3. Work, commit, push
git add . && git commit -m "feat: awesome thing"
git push -u origin feature/awesome-thing

# 4. Open PR on GitHub, get reviewed, merge

# 5. Clean up after merge
git checkout main && git pull
git branch -d feature/awesome-thing
```

## Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation

## Commit Messages

Use conventional commits:

- `feat: add new command`
- `fix: resolve path issue`
- `docs: update readme`
- `refactor: simplify utils`

## Pull Request Process

1. Update documentation if needed
2. Test your changes: `bun test`
3. Submit PR to `main` branch

## Releases

### Versioning

We use [Semantic Versioning](https://semver.org/):

- `v0.x.0-alpha.x` - Early development, breaking changes expected
- `v0.x.0-beta.x` - Feature complete, testing phase
- `vX.Y.Z` - Stable releases

### Alpha Releases

Alpha builds are tagged on `main` branch:

```bash
git tag -a v0.1.0-alpha.1 -m "Alpha release"
git push origin v0.1.0-alpha.1
```
