#!/usr/bin/env python3
"""
Jira Field Discovery (Python)
Check project configuration, issue types, and available fields.
Following jira-safe skill patterns for Next-Gen projects.
"""

import base64
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# Load .env file from jira root (two levels up from scripts/)
def load_env():
    env_path = Path(__file__).parent.parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_env()

# Configuration from environment variables
JIRA_EMAIL = os.environ.get('JIRA_EMAIL')
JIRA_API_TOKEN = os.environ.get('JIRA_API_TOKEN')
JIRA_BASE_URL = os.environ.get('JIRA_BASE_URL')
PROJECT_KEY = os.environ.get('JIRA_PROJECT_KEY', 'SCRUM')

# Validate required env vars
if not all([JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL]):
    print('Error: Missing required environment variables.', file=sys.stderr)
    print('Required: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL', file=sys.stderr)
    print('Set these in .claude/skills/jira/.env or export them manually.', file=sys.stderr)
    sys.exit(1)

# Build auth header
auth_string = f'{JIRA_EMAIL}:{JIRA_API_TOKEN}'
auth_bytes = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')

HEADERS = {
    'Authorization': f'Basic {auth_bytes}',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}


def make_request(method, path):
    """Make HTTP request to Jira API."""
    url = f'{JIRA_BASE_URL}/rest/api/3{path}'
    req = Request(url, headers=HEADERS, method=method)

    try:
        with urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:200]}')


def main():
    print('=== Checking Jira Project Configuration ===\n')

    # 1. Project Info
    print('1. PROJECT INFO:')
    project = make_request('GET', f'/project/{PROJECT_KEY}')
    print(f'   Name: {project["name"]}')
    print(f'   Type: {project.get("projectTypeKey", "unknown")}')
    print(f'   Style: {project.get("style", "unknown")}')
    print(f'   Simplified: {project.get("simplified", "unknown")}')

    # Determine if Next-Gen
    is_next_gen = project.get('style') == 'next-gen' or project.get('simplified') == True
    print(f'\n   >>> {"NEXT-GEN (Team-managed)" if is_next_gen else "CLASSIC (Company-managed)"} <<<')

    # 2. Issue Types
    print('\n2. ISSUE TYPES:')
    project_id = project['id']
    issue_types = make_request('GET', f'/issuetype/project?projectId={project_id}')
    for it in issue_types:
        subtask_marker = ' - subtask' if it.get('subtask') else ' - standard'
        print(f'   - {it["name"]} ({it["id"]}){subtask_marker}')

    # 3. Link Types
    print('\n3. LINK TYPES:')
    link_types = make_request('GET', '/issueLinkType')
    for lt in link_types.get('issueLinkTypes', []):
        print(f'   - {lt["name"]} ({lt["id"]})')
        print(f'     Inward: "{lt["inward"]}"')
        print(f'     Outward: "{lt["outward"]}"')

    # 4. Create Meta (fields available for Story)
    print('\n4. FIELDS ON STORY (create screen):')
    try:
        create_meta = make_request('GET', f'/issue/createmeta/{PROJECT_KEY}/issuetypes/10004')

        print('   Available on create screen:')
        # Handle different response formats
        if isinstance(create_meta, dict):
            if 'values' in create_meta and isinstance(create_meta['values'], list):
                for field in create_meta['values']:
                    field_id = field.get('fieldId', field.get('key', 'unknown'))
                    name = field.get('name', 'unknown')
                    required = ' (required)' if field.get('required') else ''
                    print(f'   - {field_id}: {name}{required}')
            elif 'fields' in create_meta and isinstance(create_meta['fields'], dict):
                for field_id, field_info in create_meta['fields'].items():
                    required = ' (required)' if field_info.get('required') else ''
                    print(f'   - {field_id}: {field_info.get("name", "unknown")}{required}')
    except Exception as e:
        print(f'   Could not fetch create meta: {e}')

    # 5. Next-Gen specific notes
    if is_next_gen:
        print('\n5. NEXT-GEN NOTES:')
        print('   - Use "parent" field for Epic linking (NOT customfield_10014)')
        print('   - Use "Subtask" issue type (NOT "Sub-task")')
        print('   - Epic Name field (customfield_10011) NOT available')

    print('\n' + '=' * 50)


if __name__ == '__main__':
    main()
