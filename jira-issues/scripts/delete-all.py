#!/usr/bin/env python3
"""
Jira Delete All Issues (Python)
Deletes all issues in a project.
Following jira-safe skill patterns for Next-Gen projects.

WARNING: This will permanently delete all issues!

Usage:
  python jira-delete-all.py           # Dry run (shows what would be deleted)
  python jira-delete-all.py --confirm # Actually delete
"""

import base64
import json
import os
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote

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
        if e.code == 404:
            return None
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:200]}')


def search_issues(jql, max_results=100):
    """Search issues using JQL."""
    encoded_jql = quote(jql)
    path = f'/search/jql?jql={encoded_jql}&maxResults={max_results}&fields=key'
    return make_request('GET', path)


def delete_issue(issue_key, delete_subtasks=True):
    """Delete an issue."""
    subtask_param = 'true' if delete_subtasks else 'false'
    path = f'/issue/{issue_key}?deleteSubtasks={subtask_param}'

    req = Request(
        f'{JIRA_BASE_URL}/rest/api/3{path}',
        headers=HEADERS,
        method='DELETE'
    )

    try:
        with urlopen(req) as response:
            return response.status == 204
    except HTTPError as e:
        if e.code == 404:
            return True  # Already deleted
        raise


def main():
    confirm = '--confirm' in sys.argv
    dry_run = not confirm

    print('=' * 40)
    print('  JIRA DELETE ALL ISSUES (PYTHON)')
    print('=' * 40)
    print(f'Project: {PROJECT_KEY}')
    print(f'Mode: {"DRY RUN (no changes)" if dry_run else "LIVE DELETE"}')
    print()

    # Find all issues (top-level first to handle parent/child properly)
    jql = f'project = {PROJECT_KEY} ORDER BY key ASC'

    try:
        result = search_issues(jql, max_results=500)
        issues = result.get('issues', [])
        total = result.get('total', len(issues))

        print(f'Found {total} issues to delete')

        if dry_run:
            print('\n[DRY RUN] Would delete:')
            for issue in issues[:20]:
                print(f'  - {issue["key"]}')
            if len(issues) > 20:
                print(f'  ... and {len(issues) - 20} more')
            print(f'\nRun with --confirm to actually delete.')
            return

        # Actually delete
        deleted = 0
        failed = 0

        print('\nDeleting issues...')
        for issue in issues:
            try:
                if delete_issue(issue['key']):
                    print(f'  [OK] Deleted: {issue["key"]}')
                    deleted += 1
                else:
                    print(f'  [FAIL] Failed: {issue["key"]}')
                    failed += 1
            except Exception as e:
                print(f'  [FAIL] Error {issue["key"]}: {e}')
                failed += 1

            time.sleep(0.1)  # Rate limiting

        print('\n' + '=' * 40)
        print('  SUMMARY')
        print('=' * 40)
        print(f'Deleted: {deleted}')
        print(f'Failed: {failed}')
        print('=' * 40)

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
