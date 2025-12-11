#!/usr/bin/env python3
"""
Jira Skills Test Suite (Python)
Tests authentication, project access, issue creation, and transitions.
Following jira-safe skill patterns for Next-Gen projects.
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

    print(f'\nRequest: {method} {url}')

    try:
        with urlopen(req) as response:
            status = response.status
            print(f'Response: {status} OK')
            if status == 204:
                return None
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        print(f'Response: {e.code} Error')
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:200]}')


def test_authentication():
    """Test 1: Authentication"""
    print('\n=== Test 1: Authentication ===')
    user = make_request('GET', '/myself')
    print(f'[OK] Authenticated as: {user["displayName"]} ({user["emailAddress"]})')
    print(f'  Account ID: {user["accountId"]}')
    return True


def test_get_project():
    """Test 2: Get Project"""
    print('\n=== Test 2: Get Project ===')
    project = make_request('GET', f'/project/{PROJECT_KEY}')
    print(f'[OK] Project: {project["name"]} ({project["key"]})')
    print(f'  Type: {project.get("projectTypeKey", "unknown")}')
    print(f'  ID: {project["id"]}')
    return project


def test_get_issue_types(project):
    """Test 3: Get Issue Types"""
    print('\n=== Test 3: Get Issue Types ===')
    project_id = project['id']
    issue_types = make_request('GET', f'/issuetype/project?projectId={project_id}')
    print(f'[OK] Found {len(issue_types)} issue types:')
    for it in issue_types[:5]:
        print(f'  - {it["name"]} ({it["id"]})')
    return issue_types


def test_create_issue():
    """Test 4: Create Issue"""
    print('\n=== Test 4: Create Issue ===')

    issue_data = {
        'fields': {
            'project': {'key': PROJECT_KEY},
            'issuetype': {'name': 'Story'},
            'summary': '[Test-Python] Jira API test from Python script'
        }
    }

    issue = make_request('POST', '/issue', issue_data)
    print(f'[OK] Created issue: {issue["key"]}')
    print(f'  URL: {JIRA_BASE_URL}/browse/{issue["key"]}')
    return issue


def test_get_transitions(issue_key):
    """Test 5: Get Transitions"""
    print('\n=== Test 5: Get Transitions ===')
    result = make_request('GET', f'/issue/{issue_key}/transitions?expand=transitions.fields')
    transitions = result['transitions']
    print(f'[OK] Found {len(transitions)} transitions:')
    for t in transitions:
        print(f'  - {t["id"]}: {t["name"]} -> {t["to"]["name"]}')
    return transitions


def test_transition_to_done(issue_key, transitions):
    """Test 6: Transition to Done"""
    print('\n=== Test 6: Transition to Done ===')

    # Find Done transition
    done_transition = None
    for t in transitions:
        if t['to']['name'].lower() == 'done':
            done_transition = t
            break

    if not done_transition:
        print('[FAIL] No "Done" transition available')
        return False

    print(f'  Using transition: {done_transition["id"]} ({done_transition["name"]})')

    transition_data = {
        'transition': {'id': done_transition['id']}
    }

    make_request('POST', f'/issue/{issue_key}/transitions', transition_data)
    print(f'[OK] Issue {issue_key} transitioned to Done')
    return True


def test_verify_status(issue_key):
    """Test 7: Verify Status"""
    print('\n=== Test 7: Verify Status ===')
    issue = make_request('GET', f'/issue/{issue_key}?fields=status')
    status = issue['fields']['status']['name']
    print(f'[OK] Issue {issue_key} status: {status}')
    return status == 'Done'


def main():
    print('=' * 40)
    print('  JIRA SKILLS TEST SUITE (PYTHON)')
    print('=' * 40)
    print(f'Base URL: {JIRA_BASE_URL}')
    print(f'Project: {PROJECT_KEY}')

    all_passed = True

    try:
        # Test 1: Authentication
        test_authentication()

        # Test 2: Get Project
        project = test_get_project()

        # Test 3: Get Issue Types
        test_get_issue_types(project)

        # Test 4: Create Issue
        issue = test_create_issue()
        issue_key = issue['key']

        # Test 5: Get Transitions
        transitions = test_get_transitions(issue_key)

        # Test 6: Transition to Done
        test_transition_to_done(issue_key, transitions)

        # Test 7: Verify Status
        test_verify_status(issue_key)

    except Exception as e:
        print(f'\n[FAIL] Test failed: {e}')
        all_passed = False

    print('\n' + '=' * 40)
    if all_passed:
        print('  ALL TESTS PASSED')
    else:
        print('  SOME TESTS FAILED')
    print('=' * 40)


if __name__ == '__main__':
    main()
