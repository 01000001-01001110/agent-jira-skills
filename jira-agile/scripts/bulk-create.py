#!/usr/bin/env python3
"""
Jira Bulk Create from Git Commits (Python)
Creates issues from recent git commits and transitions them to Done.
Following jira-safe skill patterns for Next-Gen projects.
"""

import base64
import json
import os
import subprocess
import sys
import time
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


def get_git_commits(count=50):
    """Get recent git commit messages."""
    try:
        result = subprocess.run(
            ['git', 'log', f'-{count}', '--pretty=format:%s'],
            capture_output=True,
            text=True,
            check=True
        )
        commits = result.stdout.strip().split('\n')
        return [c for c in commits if c]
    except subprocess.CalledProcessError:
        return []


def create_issue(summary, issue_type='Story'):
    """Create a Jira issue."""
    fields = {
        'project': {'key': PROJECT_KEY},
        'issuetype': {'name': issue_type},
        'summary': summary[:255]  # Truncate to Jira limit
    }
    return make_request('POST', '/issue', {'fields': fields})


def get_transitions(issue_key):
    """Get available transitions."""
    result = make_request('GET', f'/issue/{issue_key}/transitions')
    return result['transitions']


def transition_to_done(issue_key):
    """Transition issue to Done."""
    transitions = get_transitions(issue_key)

    # Find Done transition
    done_transition = None
    for t in transitions:
        if t['to']['name'].lower() == 'done':
            done_transition = t
            break

    if done_transition:
        data = {'transition': {'id': done_transition['id']}}
        make_request('POST', f'/issue/{issue_key}/transitions', data)
        return True
    return False


def main():
    print('=' * 40)
    print('  BULK ISSUE CREATION FROM COMMITS (PYTHON)')
    print('=' * 40)

    # Get commits
    commits = get_git_commits(50)
    print(f'\nCreating {len(commits)} issues in project {PROJECT_KEY}\n')

    if not commits:
        print('No commits found.')
        return

    # Process in batches
    batch_size = 5
    created = 0
    failed = 0

    for i in range(0, len(commits), batch_size):
        batch = commits[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(commits) + batch_size - 1) // batch_size

        print(f'\n--- Processing batch {batch_num}/{total_batches} ---')

        for commit_msg in batch:
            try:
                # Create issue
                issue = create_issue(commit_msg)
                print(f'[OK] Created {issue["key"]}: {commit_msg[:50]}...')

                # Transition to Done (already completed work)
                if transition_to_done(issue['key']):
                    print(f'  -> {issue["key"]} transitioned to Done')

                created += 1

            except Exception as e:
                print(f'[FAIL] Failed: {commit_msg[:40]}... ({e})')
                failed += 1

            time.sleep(0.1)  # Rate limiting

    print('\n' + '=' * 40)
    print('  SUMMARY')
    print('=' * 40)
    print(f'Created: {created}')
    print(f'Failed: {failed}')
    print(f'\nView: {JIRA_BASE_URL}/jira/software/projects/{PROJECT_KEY}/boards/1/backlog')
    print('=' * 40)


if __name__ == '__main__':
    main()
