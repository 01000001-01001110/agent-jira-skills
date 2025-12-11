#!/usr/bin/env python3
"""
Jira Python Utilities Template
Copy this file to your skill's scripts folder and import the utilities.

This template provides:
- Environment loading from .env
- Authentication headers setup
- Jira API request helper
- ADF (Atlassian Document Format) builder
- Common issue creation patterns
"""

import base64
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError


# ====================
# ENVIRONMENT LOADING
# ====================

def load_env(levels_up=2):
    """Load environment variables from .env file.

    Args:
        levels_up: Number of directory levels to traverse up from script location
                   to find .env file. Default is 2 (scripts/ -> skill/ -> jira/)
    """
    env_path = Path(__file__).parent
    for _ in range(levels_up):
        env_path = env_path.parent
    env_path = env_path / '.env'

    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())


def get_config():
    """Get Jira configuration from environment variables.

    Returns:
        dict with email, token, base_url, project_key

    Raises:
        SystemExit if required variables are missing
    """
    config = {
        'email': os.environ.get('JIRA_EMAIL'),
        'token': os.environ.get('JIRA_API_TOKEN'),
        'base_url': os.environ.get('JIRA_BASE_URL'),
        'project_key': os.environ.get('JIRA_PROJECT_KEY', 'SCRUM'),
        'board_id': os.environ.get('JIRA_BOARD_ID', '1')
    }

    if not all([config['email'], config['token'], config['base_url']]):
        print('Error: Missing required environment variables.', file=sys.stderr)
        print('Required: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL', file=sys.stderr)
        print('Set these in .claude/skills/jira/.env or export them manually.', file=sys.stderr)
        sys.exit(1)

    return config


def get_auth_headers(email, token):
    """Build authentication headers for Jira API.

    Args:
        email: Jira account email
        token: Jira API token

    Returns:
        dict of headers including Authorization
    """
    auth_string = f'{email}:{token}'
    auth_bytes = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')

    return {
        'Authorization': f'Basic {auth_bytes}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }


# ====================
# JIRA API REQUESTS
# ====================

def jira_request(base_url, headers, path, method='GET', data=None):
    """Make HTTP request to Jira REST API v3.

    Args:
        base_url: Jira instance URL (e.g., https://company.atlassian.net)
        headers: Authentication headers
        path: API path (e.g., '/issue')
        method: HTTP method (GET, POST, PUT, DELETE)
        data: Request body as dict (will be JSON encoded)

    Returns:
        Parsed JSON response or None for 204 responses

    Raises:
        Exception with error details on failure
    """
    url = f'{base_url}/rest/api/3{path}'
    body = json.dumps(data).encode('utf-8') if data else None
    req = Request(url, data=body, headers=headers, method=method)

    try:
        with urlopen(req) as response:
            if response.status == 204:
                return None
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:300]}')


def jira_agile_request(base_url, headers, path, method='GET', data=None):
    """Make HTTP request to Jira Agile API v1.0.

    Args:
        Same as jira_request but uses /rest/agile/1.0 base path
    """
    url = f'{base_url}/rest/agile/1.0{path}'
    body = json.dumps(data).encode('utf-8') if data else None
    req = Request(url, data=body, headers=headers, method=method)

    try:
        with urlopen(req) as response:
            if response.status == 204:
                return None
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:300]}')


# ====================
# ADF BUILDER
# ====================

def build_adf(sections):
    """Build Atlassian Document Format (ADF) from sections.

    Jira Cloud requires ADF for description fields.

    Args:
        sections: List of dicts, each can have:
            - heading: str (heading text)
            - level: int (heading level 1-6, default 2)
            - paragraph: str (paragraph text)
            - bullets: list[str] (bullet points)
            - code: str (code block content)
            - language: str (code language, default 'text')

    Returns:
        ADF document dict ready for Jira API

    Example:
        build_adf([
            {'heading': 'Overview'},
            {'paragraph': 'This is the overview text.'},
            {'heading': 'Steps', 'level': 3},
            {'bullets': ['Step 1', 'Step 2', 'Step 3']},
            {'code': 'console.log("hello")', 'language': 'javascript'}
        ])
    """
    content = []

    for section in sections:
        if 'heading' in section:
            content.append({
                'type': 'heading',
                'attrs': {'level': section.get('level', 2)},
                'content': [{'type': 'text', 'text': section['heading']}]
            })

        if 'paragraph' in section:
            content.append({
                'type': 'paragraph',
                'content': [{'type': 'text', 'text': section['paragraph']}]
            })

        if 'bullets' in section:
            content.append({
                'type': 'bulletList',
                'content': [
                    {
                        'type': 'listItem',
                        'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': bullet}]}]
                    }
                    for bullet in section['bullets']
                ]
            })

        if 'code' in section:
            content.append({
                'type': 'codeBlock',
                'attrs': {'language': section.get('language', 'text')},
                'content': [{'type': 'text', 'text': section['code']}]
            })

    return {'type': 'doc', 'version': 1, 'content': content}


def simple_adf(text):
    """Create simple ADF with just a paragraph.

    Args:
        text: Plain text string

    Returns:
        ADF document with single paragraph
    """
    return {
        'type': 'doc',
        'version': 1,
        'content': [
            {
                'type': 'paragraph',
                'content': [{'type': 'text', 'text': text}]
            }
        ]
    }


# ====================
# ISSUE CREATION
# ====================

def create_epic(base_url, headers, project_key, summary, description_sections):
    """Create an Epic issue.

    Args:
        base_url: Jira instance URL
        headers: Auth headers
        project_key: Project key (e.g., 'SCRUM')
        summary: Epic title
        description_sections: List of sections for build_adf()

    Returns:
        Created issue response
    """
    fields = {
        'project': {'key': project_key},
        'issuetype': {'name': 'Epic'},
        'summary': summary,
        'description': build_adf(description_sections)
    }
    return jira_request(base_url, headers, '/issue', method='POST', data={'fields': fields})


def create_story(base_url, headers, project_key, summary, description_sections, parent_epic_key=None, labels=None):
    """Create a Story issue.

    Args:
        base_url: Jira instance URL
        headers: Auth headers
        project_key: Project key
        summary: Story title (use SAFe format: "As a X, I want Y, so that Z")
        description_sections: List of sections for build_adf()
        parent_epic_key: Optional Epic key to link story (Next-Gen projects)
        labels: Optional list of labels

    Returns:
        Created issue response
    """
    fields = {
        'project': {'key': project_key},
        'issuetype': {'name': 'Story'},
        'summary': summary,
        'description': build_adf(description_sections)
    }

    if parent_epic_key:
        fields['parent'] = {'key': parent_epic_key}

    if labels:
        fields['labels'] = labels

    return jira_request(base_url, headers, '/issue', method='POST', data={'fields': fields})


def create_subtask(base_url, headers, project_key, parent_key, summary):
    """Create a Subtask under a parent Story.

    NOTE: Next-Gen projects use 'Subtask' (no hyphen)
          Classic projects use 'Sub-task' (with hyphen)

    Args:
        base_url: Jira instance URL
        headers: Auth headers
        project_key: Project key
        parent_key: Parent Story key
        summary: Subtask title

    Returns:
        Created issue response
    """
    fields = {
        'project': {'key': project_key},
        'issuetype': {'name': 'Subtask'},  # Next-Gen
        'parent': {'key': parent_key},
        'summary': summary
    }
    return jira_request(base_url, headers, '/issue', method='POST', data={'fields': fields})


# ====================
# UTILITY FUNCTIONS
# ====================

def get_issue(base_url, headers, issue_key, fields=None):
    """Get an issue by key.

    Args:
        base_url: Jira instance URL
        headers: Auth headers
        issue_key: Issue key (e.g., 'SCRUM-123')
        fields: Optional comma-separated field names

    Returns:
        Issue data
    """
    path = f'/issue/{issue_key}'
    if fields:
        path += f'?fields={fields}'
    return jira_request(base_url, headers, path)


def search_issues(base_url, headers, jql, fields=None, max_results=50):
    """Search issues using JQL.

    Args:
        base_url: Jira instance URL
        headers: Auth headers
        jql: JQL query string
        fields: List of field names to return
        max_results: Maximum results to return

    Returns:
        Search results with issues array
    """
    data = {
        'jql': jql,
        'maxResults': max_results
    }
    if fields:
        data['fields'] = fields

    return jira_request(base_url, headers, '/search', method='POST', data=data)


def delete_issue(base_url, headers, issue_key):
    """Delete an issue.

    Args:
        base_url: Jira instance URL
        headers: Auth headers
        issue_key: Issue key to delete
    """
    return jira_request(base_url, headers, f'/issue/{issue_key}', method='DELETE')


# ====================
# EXAMPLE USAGE
# ====================

if __name__ == '__main__':
    # Load environment
    load_env()
    config = get_config()
    headers = get_auth_headers(config['email'], config['token'])

    # Test connection
    print('Testing Jira connection...')
    try:
        user = jira_request(config['base_url'], headers, '/myself')
        print(f"Connected as: {user['displayName']} ({user['emailAddress']})")
    except Exception as e:
        print(f'Connection failed: {e}')
        sys.exit(1)
