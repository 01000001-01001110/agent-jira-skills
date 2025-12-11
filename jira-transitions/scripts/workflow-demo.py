#!/usr/bin/env python3
"""
Jira Workflow Demo (Python)
Demonstrates workflow transitions: To Do -> Progressing -> Done
Following jira-safe skill patterns for Next-Gen projects.

Usage:
  python jira-workflow-demo.py demo SCRUM-123
  python jira-workflow-demo.py start SCRUM-123
  python jira-workflow-demo.py complete SCRUM-123
  python jira-workflow-demo.py reopen SCRUM-123
  python jira-workflow-demo.py status SCRUM-123
"""

import base64
import json
import os
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


def get_issue(issue_key):
    """Get issue details."""
    return make_request('GET', f'/issue/{issue_key}?fields=summary,status')


def get_transitions(issue_key):
    """Get available transitions for an issue."""
    result = make_request('GET', f'/issue/{issue_key}/transitions?expand=transitions.fields')
    return result['transitions']


def do_transition(issue_key, transition_id):
    """Execute a transition."""
    data = {'transition': {'id': transition_id}}
    make_request('POST', f'/issue/{issue_key}/transitions', data)


def add_comment(issue_key, comment_text):
    """Add a comment to an issue."""
    data = {
        'body': {
            'type': 'doc',
            'version': 1,
            'content': [
                {
                    'type': 'paragraph',
                    'content': [{'type': 'text', 'text': comment_text}]
                }
            ]
        }
    }
    make_request('POST', f'/issue/{issue_key}/comment', data)


def transition_to(issue_key, target_status):
    """Transition issue to a target status."""
    transitions = get_transitions(issue_key)

    # Find matching transition
    transition = None
    for t in transitions:
        if t['to']['name'].lower() == target_status.lower() or t['name'].lower() == target_status.lower():
            transition = t
            break

    if not transition:
        print(f'No transition to "{target_status}" available.')
        print('Available transitions:')
        for t in transitions:
            print(f'  - {t["name"]} -> {t["to"]["name"]}')
        return False

    do_transition(issue_key, transition['id'])
    return True


def show_status(issue_key):
    """Show current issue status."""
    issue = get_issue(issue_key)
    status = issue['fields']['status']['name']
    summary = issue['fields']['summary']
    print(f'{issue_key}: {status}')
    print(f'Summary: {summary}')


def run_demo(issue_key):
    """Run full workflow demo."""
    print('=' * 40)
    print('  JIRA WORKFLOW DEMO (PYTHON)')
    print('=' * 40)
    print(f'\nIssue: {issue_key}')
    print(f'Project: {PROJECT_KEY}')
    print(f'URL: {JIRA_BASE_URL}/browse/{issue_key}')

    # Step 1: Check current status
    print('\n--- Step 1: Check Current Status ---')
    issue = get_issue(issue_key)
    current_status = issue['fields']['status']['name']
    print(f'Initial status: {current_status}')

    # Step 2: Show available transitions
    print('\n--- Step 2: Available Transitions ---')
    transitions = get_transitions(issue_key)
    print(f'Found {len(transitions)} transitions:')
    for t in transitions:
        print(f'  - {t["id"]}: "{t["name"]}" -> {t["to"]["name"]}')

    # Step 3: Start work (transition to Progressing)
    print('\n--- Step 3: Start Work ---')
    print(f'\nStarting work on {issue_key}...')
    issue = get_issue(issue_key)
    print(f'  Current status: {issue["fields"]["status"]["name"]}')

    if transition_to(issue_key, 'Progressing'):
        add_comment(issue_key, '[Python Demo] Work started')
        print('  Transitioned to: Progressing')
        print('  Added start comment')

    # Step 4: Simulate work
    print('\n--- Step 4: Simulating Work ---')
    print('  [Simulating development work...]')
    time.sleep(1)
    print('  [Work complete!]')

    # Step 5: Complete work
    print('\n--- Step 5: Complete Work ---')
    print(f'\nCompleting work on {issue_key}...')
    issue = get_issue(issue_key)
    print(f'  Current status: {issue["fields"]["status"]["name"]}')

    if transition_to(issue_key, 'Done'):
        add_comment(issue_key, '[Python Demo] Work completed')
        print('  Transitioned to: Done')
        print('  Added completion comment')

    # Step 6: Final status
    print('\n--- Step 6: Final Status ---')
    issue = get_issue(issue_key)
    print(f'Final status: {issue["fields"]["status"]["name"]}')

    print('\n' + '=' * 40)
    print('  WORKFLOW DEMO COMPLETE')
    print('=' * 40)
    print(f'\nView issue: {JIRA_BASE_URL}/browse/{issue_key}')


def main():
    if len(sys.argv) < 2:
        print('Usage:')
        print('  python jira-workflow-demo.py demo SCRUM-55')
        print('  python jira-workflow-demo.py start SCRUM-55')
        print('  python jira-workflow-demo.py complete SCRUM-55')
        print('  python jira-workflow-demo.py reopen SCRUM-55')
        print('  python jira-workflow-demo.py status SCRUM-55')
        sys.exit(0)

    action = sys.argv[1]
    issue_key = sys.argv[2] if len(sys.argv) > 2 else None

    if not issue_key and action != 'help':
        print('Error: Issue key required')
        sys.exit(1)

    try:
        if action == 'demo':
            run_demo(issue_key)
        elif action == 'start':
            print(f'Starting work on {issue_key}...')
            if transition_to(issue_key, 'Progressing'):
                add_comment(issue_key, 'Work started')
                print(f'[OK] {issue_key} transitioned to Progressing')
        elif action == 'complete':
            print(f'Completing work on {issue_key}...')
            if transition_to(issue_key, 'Done'):
                add_comment(issue_key, 'Work completed')
                print(f'[OK] {issue_key} transitioned to Done')
        elif action == 'reopen':
            print(f'Reopening {issue_key}...')
            if transition_to(issue_key, 'To Do'):
                add_comment(issue_key, 'Issue reopened')
                print(f'[OK] {issue_key} transitioned to To Do')
        elif action == 'status':
            show_status(issue_key)
        else:
            print(f'Unknown action: {action}')
            sys.exit(1)

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
