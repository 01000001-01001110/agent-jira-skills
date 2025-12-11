#!/usr/bin/env python3
"""
Jira Create Single Issue (Python)
Creates a single test story in the backlog.
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


def make_request(method, path, data=None):
    """Make HTTP request to Jira API."""
    url = f'{JIRA_BASE_URL}/rest/api/3{path}'

    body = json.dumps(data).encode('utf-8') if data else None
    req = Request(url, data=body, headers=HEADERS, method=method)

    try:
        with urlopen(req) as response:
            status = response.status
            if status == 204:
                return None
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:200]}')


def create_issue(summary, issue_type='Story', description=None, parent_key=None):
    """Create a Jira issue."""
    fields = {
        'project': {'key': PROJECT_KEY},
        'issuetype': {'name': issue_type},
        'summary': summary
    }

    # Add description in ADF format if provided
    if description:
        fields['description'] = {
            'type': 'doc',
            'version': 1,
            'content': [
                {
                    'type': 'paragraph',
                    'content': [{'type': 'text', 'text': description}]
                }
            ]
        }

    # Next-Gen: Link to parent Epic using 'parent' field
    if parent_key:
        fields['parent'] = {'key': parent_key}

    return make_request('POST', '/issue', {'fields': fields})


def main():
    print('Creating test story in backlog...\n')

    try:
        issue = create_issue(
            summary='[Test-Python] Story created from Python script',
            description='This is a test story created by the Python Jira script.'
        )

        print('[OK] Story created successfully!\n')
        print(f'Key: {issue["key"]}')
        print(f'ID: {issue["id"]}')
        print(f'\nDirect link: {JIRA_BASE_URL}/browse/{issue["key"]}')
        print(f'\nBacklog: {JIRA_BASE_URL}/jira/software/projects/{PROJECT_KEY}/boards/1/backlog')

        # Get issue status
        issue_details = make_request('GET', f'/issue/{issue["key"]}?fields=status')
        print(f'\nStatus: {issue_details["fields"]["status"]["name"]}')

    except Exception as e:
        print(f'[FAIL] Error: {e}')


if __name__ == '__main__':
    main()
