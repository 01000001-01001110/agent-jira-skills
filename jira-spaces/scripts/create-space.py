#!/usr/bin/env python3
"""
Create Confluence Space
Creates a new Confluence space for documentation.

Usage:
  python create-space.py KEY "Space Name"
  python create-space.py KEY "Space Name" "Description"

Example:
  python create-space.py DOCS "Project Documentation" "Technical docs and guides"
"""

import base64
import json
import os
import re
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

JIRA_EMAIL = os.environ.get('JIRA_EMAIL')
JIRA_API_TOKEN = os.environ.get('JIRA_API_TOKEN')
JIRA_BASE_URL = os.environ.get('JIRA_BASE_URL')

if not all([JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL]):
    print('Error: Missing required environment variables.', file=sys.stderr)
    print('Required: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL', file=sys.stderr)
    sys.exit(1)

auth_string = f'{JIRA_EMAIL}:{JIRA_API_TOKEN}'
auth_bytes = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')

HEADERS = {
    'Authorization': f'Basic {auth_bytes}',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}


def confluence_request(path, method='GET', data=None):
    """Make HTTP request to Confluence API."""
    url = f'{JIRA_BASE_URL}/wiki/rest/api{path}'

    body = json.dumps(data).encode('utf-8') if data else None
    req = Request(url, data=body, headers=HEADERS, method=method)

    try:
        with urlopen(req) as response:
            if response.status in (204, 202):
                return None
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:300]}')


def create_space(key, name, description=''):
    """Create a Confluence space."""
    data = {
        'key': key.upper(),
        'name': name,
        'type': 'global'
    }

    if description:
        data['description'] = {
            'plain': {
                'value': description,
                'representation': 'plain'
            }
        }

    return confluence_request('/space', method='POST', data=data)


def show_usage():
    print('''
Create Confluence Space

Usage:
  python create-space.py KEY "Space Name"
  python create-space.py KEY "Space Name" "Description"

Arguments:
  KEY         Space key (uppercase letters/numbers, no spaces)
  Name        Display name for the space
  Description Optional description

Examples:
  python create-space.py DOCS "Project Documentation"
  python create-space.py TUSTLE "Tustle Docs" "Technical documentation for Tustle MVP"
''')


def main():
    args = sys.argv[1:]

    if len(args) < 2 or '--help' in args or '-h' in args:
        show_usage()
        sys.exit(0 if '--help' in args or '-h' in args else 1)

    space_key = args[0].upper()
    space_name = args[1]
    description = args[2] if len(args) > 2 else ''

    # Validate space key
    if not re.match(r'^[A-Z][A-Z0-9]*$', space_key):
        print('Error: Space key must start with a letter and contain only uppercase letters and numbers.')
        print('Example: DOCS, PROJ, TUSTLE')
        sys.exit(1)

    print('=' * 40)
    print('  CREATE CONFLUENCE SPACE')
    print('=' * 40 + '\n')

    print('Creating space:')
    print(f'  Key:         {space_key}')
    print(f'  Name:        {space_name}')
    if description:
        print(f'  Description: {description}')
    print('')

    try:
        space = create_space(space_key, space_name, description)

        print('Space created successfully!\n')
        print('=' * 40)
        print('  DETAILS')
        print('=' * 40)
        print(f"Key:    {space['key']}")
        print(f"Name:   {space['name']}")
        print(f"Type:   {space['type']}")
        print(f"ID:     {space['id']}")
        print(f"Status: {space.get('status', 'current')}")

        print('\n' + '=' * 40)
        print('  LINKS')
        print('=' * 40)
        print(f"Web:    {JIRA_BASE_URL}/wiki/spaces/{space['key']}")
        print(f"API:    {JIRA_BASE_URL}/wiki/rest/api/space/{space['key']}")
        print('=' * 40 + '\n')

    except Exception as e:
        error_msg = str(e)
        if '409' in error_msg:
            print(f"Error: Space with key '{space_key}' already exists.")
            print('Please choose a different space key.')
        elif '403' in error_msg:
            print('Error: You do not have permission to create spaces.')
            print('Contact your Confluence administrator.')
        else:
            print(f'Error creating space: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
