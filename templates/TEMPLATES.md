# Jira Templates

Organization standard templates for creating Epics, Stories, and Subtasks following SAFe methodology.

## Template Files

| Template | Purpose |
|----------|---------|
| `epic-template.json` | Epic structure with Business Outcome, Success Metrics, Scope |
| `story-template.json` | User Story with Acceptance Criteria (Given/When/Then), Definition of Done |
| `subtask-template.json` | Subtask naming patterns and common task breakdowns |
| `python-jira-utils.py` | Reusable Python utilities for Jira API |

## Epic Template

Epics represent major initiatives with business value. Use the SAFe format:

```json
{
  "summary": "[Epic Name] - [Brief Value Statement]",
  "description": {
    "sections": [
      "Business Outcome: What value does this deliver?",
      "Success Metrics: How do we measure success?",
      "Scope: What's IN and OUT of scope?",
      "Target Users: Who benefits?",
      "Dependencies: What's needed first?"
    ]
  }
}
```

### Required Sections

1. **Business Outcome** - The business value delivered
2. **Success Metrics** - Measurable KPIs (use specific numbers)
3. **Scope** - IN SCOPE and OUT OF SCOPE clearly defined
4. **Target Users** - User personas who benefit

## Story Template

Stories follow the SAFe user story format:

```
As a [user type], I want [goal], so that [benefit]
```

### Required Sections

1. **User Story** - Full user story statement
2. **Acceptance Criteria** - Scenarios in Given/When/Then format
3. **Definition of Done** - Checklist of completion requirements

### Acceptance Criteria Format

Use Gherkin syntax for each scenario:

```markdown
### Scenario 1: [Happy Path Name]
- GIVEN [precondition/context]
- WHEN [action/trigger]
- THEN [expected result]

### Scenario 2: [Edge Case/Error Name]
- GIVEN [precondition/context]
- WHEN [action/trigger]
- THEN [expected result]
```

### Definition of Done Checklist

Standard DoD items:
- [ ] Code implemented and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Deployed to staging and tested

## Subtask Template

Subtasks break Stories into implementable work items.

### Naming Convention

Use action verb format:
- `Create [component/endpoint]`
- `Implement [functionality]`
- `Add [feature]`
- `Write [tests/docs]`
- `Configure [setting]`

### Common Patterns

**API Endpoint:**
1. Create API route [path]
2. Add input validation schema
3. Implement error handling
4. Write unit tests
5. Add API documentation

**UI Component:**
1. Create component skeleton
2. Implement UI layout
3. Add state management
4. Connect to API
5. Add loading/error states
6. Write component tests

**Database Change:**
1. Create database migration
2. Add indexes for queries
3. Create seed data
4. Test query performance

## Python Utilities Template

The `python-jira-utils.py` provides reusable functions:

```python
from templates.python_jira_utils import (
    load_env,
    get_config,
    get_auth_headers,
    jira_request,
    build_adf,
    create_epic,
    create_story,
    create_subtask
)

# Load environment
load_env()
config = get_config()
headers = get_auth_headers(config['email'], config['token'])

# Create issues
epic = create_epic(
    config['base_url'],
    headers,
    config['project_key'],
    'My Epic Title',
    [
        {'heading': 'Business Outcome'},
        {'paragraph': 'Description here...'},
        {'heading': 'Success Metrics'},
        {'bullets': ['Metric 1', 'Metric 2']}
    ]
)
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `load_env()` | Load .env file |
| `get_config()` | Get Jira config from env |
| `get_auth_headers()` | Build auth headers |
| `jira_request()` | Make API calls |
| `build_adf()` | Build Atlassian Doc Format |
| `create_epic()` | Create Epic issue |
| `create_story()` | Create Story issue |
| `create_subtask()` | Create Subtask issue |

## ADF (Atlassian Document Format)

Jira Cloud requires ADF for description fields. Use `build_adf()`:

```python
description = build_adf([
    {'heading': 'Section Title'},
    {'paragraph': 'Normal text paragraph.'},
    {'heading': 'Subsection', 'level': 3},
    {'bullets': ['Item 1', 'Item 2', 'Item 3']},
    {'code': 'console.log("hello")', 'language': 'javascript'}
])
```

### Supported Elements

| Element | Properties |
|---------|------------|
| Heading | `heading`, `level` (1-6, default 2) |
| Paragraph | `paragraph` |
| Bullet List | `bullets` (list of strings) |
| Code Block | `code`, `language` (default 'text') |

## Next-Gen vs Classic Projects

These templates are built for **Next-Gen (team-managed)** projects.

| Aspect | Classic | Next-Gen |
|--------|---------|----------|
| Subtask type | `'Sub-task'` | `'Subtask'` |
| Epic link | `customfield_10014` | `parent: { key: 'EPIC-KEY' }` |
| Epic Name | `customfield_10011` | Not available |

## Usage in Scripts

Copy relevant code from templates into your skill scripts:

```python
# In your script
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'templates'))
from python_jira_utils import *
```

Or copy the functions you need directly into your script.
