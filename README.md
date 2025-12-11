# Jira Skills for Claude Code

Jira Cloud REST API skills for Claude Code CLI. Built for Next-Gen (team-managed) projects.

## Table of Contents

- [What This Is](#what-this-is)
- [Structure](#structure)
- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [Skills](#skills)
- [API Reference](#api-reference)
- [Next-Gen vs Classic](#next-gen-vs-classic)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## What This Is

A collection of Claude Code skills for interacting with Jira's REST API. Each skill is a self-contained folder with:

- `SKILL.md` - Markdown with YAML frontmatter that Claude reads
- `scripts/` - Runnable Node.js and Python scripts for that domain

Skills cover: authentication, issues, search, transitions, agile boards, projects, SAFe patterns, and Confluence spaces.

## Structure

```
jira/
├── .env                    # Your credentials (not committed)
├── .env.example            # Template
├── .gitignore
├── README.md
├── run.js                  # Script runner
├── .github/
│   ├── workflows/
│   │   └── ci.yml          # CI checks
│   └── hooks/
│       └── pre-commit      # Local pre-commit hook
├── templates/              # Organization standard templates
│   ├── TEMPLATES.md        # Template documentation
│   ├── epic-template.json  # Epic structure template
│   ├── story-template.json # User Story SAFe template
│   ├── subtask-template.json # Subtask patterns
│   └── python-jira-utils.py  # Reusable Python utilities
├── jira-auth/
│   ├── SKILL.md
│   └── scripts/
│       ├── test.mjs
│       └── test.py
├── jira-issues/
│   ├── SKILL.md
│   └── scripts/
│       ├── create-one.mjs
│       ├── create-one.py
│       ├── delete-all.mjs
│       └── delete-all.py
├── jira-search/
│   ├── SKILL.md
│   └── scripts/
│       ├── check-issues.mjs
│       └── check-issues.py
├── jira-transitions/
│   ├── SKILL.md
│   └── scripts/
│       ├── workflow-demo.mjs
│       └── workflow-demo.py
├── jira-agile/
│   ├── SKILL.md
│   └── scripts/
│       ├── bulk-create.mjs
│       └── bulk-create.py
├── jira-projects/
│   ├── SKILL.md
│   └── scripts/
│       ├── check-fields.mjs
│       └── check-fields.py
├── jira-project-management/
│   └── SKILL.md
├── jira-workflow/
│   └── SKILL.md
├── jira-safe/
│   ├── SKILL.md
│   └── scripts/
│       ├── add-subtasks.mjs
│       ├── add-subtasks.py
│       ├── create-two-level.mjs
│       ├── create-two-level.py
│       ├── create-mvp.mjs
│       └── create-mvp.py
└── jira-spaces/
    ├── SKILL.md
    └── scripts/
        ├── list-spaces.mjs
        ├── list-spaces.py
        ├── create-space.mjs
        ├── create-space.py
        ├── delete-space.mjs
        └── delete-space.py
```

## Installation

### For Claude Code CLI

Claude Code discovers skills at `.claude/skills/[skill-name]/SKILL.md`. Each skill has YAML frontmatter with `name` and `description` fields.

**Option 1: Clone into .claude/skills/**

```bash
cd your-project/.claude/skills
git clone https://github.com/your-repo/jira-skills.git jira
```

Skills are nested inside `jira/` so they won't auto-discover. Reference them in your project's CLAUDE.md or use the scripts directly.

**Option 2: Symlink individual skills**

```bash
cd your-project/.claude/skills
git clone https://github.com/your-repo/jira-skills.git jira

# Create symlinks for auto-discovery
ln -s jira/jira-auth jira-auth
ln -s jira/jira-issues jira-issues
ln -s jira/jira-search jira-search
# ... etc
```

**Option 3: Copy skills you need**

```bash
cp -r jira-skills/jira-auth your-project/.claude/skills/
cp -r jira-skills/jira-issues your-project/.claude/skills/
```

### Standalone Usage

Clone anywhere and run scripts directly:

```bash
git clone https://github.com/your-repo/jira-skills.git
cd jira-skills
cp .env.example .env
# Edit .env with your credentials
node run.js test
```

## Setup

### 1. Get an API Token

Go to https://id.atlassian.com/manage-profile/security/api-tokens and create a token.

### 2. Create .env File

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `JIRA_EMAIL` | Yes | Your Atlassian account email |
| `JIRA_API_TOKEN` | Yes | API token from step 1 |
| `JIRA_BASE_URL` | Yes | Your instance URL (e.g., `https://yourcompany.atlassian.net`) |
| `JIRA_PROJECT_KEY` | No | Default project key (defaults to `SCRUM`) |
| `JIRA_BOARD_ID` | No | Default board ID (defaults to `1`) |

### 3. Test It

```bash
node run.js test
```

## Usage

### Script Runner

The `run.js` script runs commands from any skill's scripts folder:

```bash
node run.js <command> [args...]
node run.js --python <command> [args...]   # Force Python
node run.js --node <command> [args...]     # Force Node.js
```

### Commands

| Command | Skill | Description | Node.js | Python |
|---------|-------|-------------|:-------:|:------:|
| `test` | jira-auth | Verify authentication and run test suite | Yes | Yes |
| `check-fields` | jira-projects | List project fields and configuration | Yes | Yes |
| `check-issues` | jira-search | List issues in project | Yes | Yes |
| `create-one` | jira-issues | Create a single test issue | Yes | Yes |
| `delete-all` | jira-issues | Delete all issues (dry run by default) | Yes | Yes |
| `workflow-demo` | jira-transitions | Demonstrate workflow transitions | Yes | Yes |
| `bulk-create` | jira-agile | Create issues from git commits | Yes | Yes |
| `add-subtasks` | jira-safe | Add subtasks to an issue | Yes | Yes |
| `create-two-level` | jira-safe | Create Epic/Story/Subtask hierarchy | Yes | Yes |
| `create-mvp` | jira-safe | Create full MVP backlog | Yes | Yes |
| `list-spaces` | jira-spaces | List Confluence spaces | Yes | Yes |
| `create-space` | jira-spaces | Create a Confluence space | Yes | Yes |
| `delete-space` | jira-spaces | Delete a Confluence space | Yes | Yes |

### Command Examples

```bash
# Authentication test
node run.js test

# List all issues
node run.js check-issues

# Create a test issue
node run.js create-one

# Delete all issues (dry run first)
node run.js delete-all
node run.js delete-all --confirm   # Actually delete

# Workflow transitions
node run.js workflow-demo status SCRUM-123      # Check status
node run.js workflow-demo start SCRUM-123       # Move to In Progress
node run.js workflow-demo complete SCRUM-123    # Move to Done
node run.js workflow-demo demo SCRUM-123        # Full cycle demo

# Add subtasks
node run.js add-subtasks demo                              # Create demo story with subtasks
node run.js add-subtasks SCRUM-123 "Task 1" "Task 2"       # Add to existing issue

# Create hierarchy
node run.js create-two-level    # Epic -> Stories -> Subtasks
node run.js create-mvp          # Full MVP backlog structure

# Confluence spaces
node run.js list-spaces                           # List all spaces
node run.js list-spaces --type global --limit 50  # Filter and limit
node run.js create-space DOCS "Project Docs"      # Create a space
node run.js create-space DOCS "Docs" "Description"
node run.js delete-space DOCS                     # Interactive delete
node run.js delete-space DOCS --confirm           # Force delete
```

### Direct Script Execution

Run scripts directly without the runner:

```bash
# Python (loads .env automatically)
python jira-auth/scripts/test.py
python jira-issues/scripts/create-one.py

# Node.js (needs env vars set)
export JIRA_EMAIL=... JIRA_API_TOKEN=... JIRA_BASE_URL=...
node jira-issues/scripts/create-one.mjs
```

### Platform Notes

- **Windows**: Python handles console encoding better. Runner auto-detects and prefers Python.
- **Linux/macOS**: Node.js works well and has faster startup.
- **CI/CD**: Either runtime works. Set environment variables directly.

## Skills

| Skill | What It Covers |
|-------|----------------|
| `jira-auth` | Authentication, headers, rate limiting |
| `jira-issues` | Create, read, update, delete issues |
| `jira-search` | JQL queries, pagination, field selection |
| `jira-transitions` | Move issues through workflow states |
| `jira-agile` | Boards, sprints, backlog management |
| `jira-projects` | Project info, issue types, statuses |
| `jira-project-management` | Components, versions, roles, permissions |
| `jira-workflow` | End-to-end workflow orchestration |
| `jira-safe` | SAFe patterns (Epic/Story/Subtask hierarchy) |
| `jira-spaces` | Confluence space management (create, list, delete) |

Each `SKILL.md` contains:
- YAML frontmatter with `name` and `description`
- Implementation patterns in TypeScript/JavaScript/Python
- curl examples
- Common mistakes and solutions

## Templates

The `templates/` folder contains organization standard templates for creating Jira issues following SAFe methodology.

| Template | Purpose |
|----------|---------|
| `epic-template.json` | Epic structure with Business Outcome, Success Metrics, Scope |
| `story-template.json` | User Story with Acceptance Criteria (Given/When/Then), Definition of Done |
| `subtask-template.json` | Subtask naming patterns and common task breakdowns |
| `python-jira-utils.py` | Reusable Python utilities for Jira API |
| `TEMPLATES.md` | Full documentation for using templates |

### Template Usage

Templates follow SAFe (Scaled Agile Framework) patterns:

**Epic Format:**
- Business Outcome
- Success Metrics (measurable KPIs)
- Scope (IN/OUT)
- Target Users

**Story Format:**
- User Story: "As a [user], I want [goal], so that [benefit]"
- Acceptance Criteria: Given/When/Then scenarios
- Definition of Done checklist

**Subtask Naming:**
- Action verb format: "Create X", "Implement Y", "Add Z"

See `templates/TEMPLATES.md` for complete documentation.

## API Reference

### Core API (`/rest/api/3/`)

| Endpoint | Method | Use |
|----------|--------|-----|
| `/myself` | GET | Test auth, get current user |
| `/project/{key}` | GET | Project details |
| `/issue` | POST | Create issue |
| `/issue/{key}` | GET, PUT, DELETE | Read, update, delete issue |
| `/issue/{key}/transitions` | GET, POST | Get/execute transitions |
| `/search` | POST | JQL search |

### Agile API (`/rest/agile/1.0/`)

| Endpoint | Method | Use |
|----------|--------|-----|
| `/board` | GET | List boards |
| `/board/{id}/sprint` | GET | List sprints |
| `/sprint/{id}/issue` | GET, POST | Sprint issues |
| `/sprint` | POST | Create sprint |

### Auth Header

```javascript
const auth = Buffer.from(`${email}:${token}`).toString('base64');
headers['Authorization'] = `Basic ${auth}`;
```

### Atlassian Document Format (ADF)

Descriptions require ADF, not plain text:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "Your text"}]
    }
  ]
}
```

## Next-Gen vs Classic

These skills are built for **Next-Gen (team-managed)** projects. Key differences:

| Aspect | Classic (Company-managed) | Next-Gen (Team-managed) |
|--------|---------------------------|-------------------------|
| Epic linking | `customfield_10014` | `parent: { key: 'EPIC-KEY' }` |
| Epic Name field | `customfield_10011` | Not available |
| Subtask type | `'Sub-task'` | `'Subtask'` |
| Project style | `classic` | `next-gen`, `simplified: true` |

Detect project type:

```javascript
const project = await fetch(`${JIRA_URL}/rest/api/3/project/${key}`);
const isNextGen = project.style === 'next-gen' || project.simplified === true;
```

## Troubleshooting

**401 Unauthorized**
- Token expired or invalid
- Email doesn't match the Atlassian account
- Token doesn't have API permissions

**403 Forbidden**
- No permission to access the project/resource
- Check project roles and permissions

**400 Bad Request**
- Missing required fields (`project.key`, `summary`, `issuetype.name`)
- Invalid ADF in description
- Invalid transition ID (query available transitions first)

**404 Not Found**
- Issue or project doesn't exist
- Typo in the key

**429 Too Many Requests**
- Rate limited. Jira Cloud allows ~900 requests/hour per user.
- Back off and retry with exponential delay.

## Rate Limits

Jira Cloud allows approximately 900 requests per hour per user. If you receive 429 responses:

1. Check `X-RateLimit-Remaining` header
2. Wait until `X-RateLimit-Reset` timestamp
3. Implement exponential backoff for retries

## Contributing

### CI Checks

Pull requests run automated checks:
- YAML frontmatter validation on SKILL.md files
- Node.js syntax validation
- Python syntax validation
- Structure validation
- Secret detection

### Local Pre-commit Hook

Install the pre-commit hook to catch issues before pushing:

```bash
cp .github/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Adding a New Skill

1. Create folder: `jira-newskill/`
2. Add `SKILL.md` with frontmatter:
   ```yaml
   ---
   name: jira-newskill
   description: Brief description for Claude to know when to use this skill.
   ---
   ```
3. Add `scripts/` folder with `.mjs` and/or `.py` scripts
4. Update `run.js` script mappings
5. Update README commands table

## License

MIT
