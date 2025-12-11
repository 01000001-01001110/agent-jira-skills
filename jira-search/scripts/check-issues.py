#!/usr/bin/env python3
"""
Jira Issue Listing (Python)
List issues in a project using JQL search.
Following jira-safe skill patterns for Next-Gen projects.
"""

import base64
import json
import os
import sys
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
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:200]}')


def search_issues(jql, max_results=20):
    """Search issues using JQL."""
    # Use the new search/jql endpoint
    encoded_jql = quote(jql)
    path = f'/search/jql?jql={encoded_jql}&maxResults={max_results}&fields=key,summary,status,issuetype,parent'
    return make_request('GET', path)


def main():
    # Parse command line args
    max_results = 20
    status_filter = None

    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.isdigit():
                max_results = int(arg)
            elif arg in ['todo', 'done', 'progressing', 'all']:
                status_filter = arg

    print(f'Searching for {PROJECT_KEY} issues...\n')

    # Build JQL
    jql = f'project = {PROJECT_KEY}'
    if status_filter and status_filter != 'all':
        if status_filter == 'todo':
            jql += ' AND status = "To Do"'
        elif status_filter == 'done':
            jql += ' AND status = "Done"'
        elif status_filter == 'progressing':
            jql += ' AND status = "Progressing"'

    jql += ' ORDER BY key DESC'

    try:
        result = search_issues(jql, max_results)
        total = result.get('total', 0)
        issues = result.get('issues', [])

        print(f'Found {total} issues (showing {len(issues)}):\n')

        for issue in issues:
            key = issue['key']
            status = issue['fields']['status']['name']
            summary = issue['fields']['summary'][:60]
            issue_type = issue['fields']['issuetype']['name']
            parent = issue['fields'].get('parent', {}).get('key', '')

            parent_str = f' (parent: {parent})' if parent else ''
            print(f'{key}: [{issue_type}] {status} - {summary}...{parent_str}')
            print(f'  Link: {JIRA_BASE_URL}/browse/{key}')

        print(f'\nTotal: {total} issues')

    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
