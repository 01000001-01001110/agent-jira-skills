#!/usr/bin/env python3
"""
Delete Confluence Space
Deletes a Confluence space and all its content.

WARNING: This permanently deletes all pages in the space!

Usage:
  python delete-space.py KEY              (interactive confirmation)
  python delete-space.py KEY --confirm    (skip confirmation)

Example:
  python delete-space.py DOCS
  python delete-space.py DOCS --confirm
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


def get_space(key):
    """Get space details."""
    try:
        return confluence_request(f'/space/{key}?expand=description.plain')
    except:
        return None


def delete_space(key):
    """Delete a Confluence space."""
    return confluence_request(f'/space/{key}', method='DELETE')


def show_usage():
    print('''
Delete Confluence Space

WARNING: This permanently deletes a space and ALL its content!

Usage:
  python delete-space.py KEY              (interactive confirmation)
  python delete-space.py KEY --confirm    (skip confirmation)

Arguments:
  KEY       Space key to delete
  --confirm Skip interactive confirmation (use with caution!)

Examples:
  python delete-space.py DOCS
  python delete-space.py TEMP --confirm
''')


def main():
    args = sys.argv[1:]

    if len(args) < 1 or '--help' in args or '-h' in args:
        show_usage()
        sys.exit(0 if '--help' in args or '-h' in args else 1)

    space_key = args[0].upper()
    skip_confirm = '--confirm' in args

    print('=' * 40)
    print('  DELETE CONFLUENCE SPACE')
    print('=' * 40 + '\n')

    # First, check if space exists
    print(f'Looking up space {space_key}...')
    space = get_space(space_key)

    if not space:
        print(f"Error: Space '{space_key}' not found.")
        sys.exit(1)

    print('\nSpace found:')
    print(f"  Key:    {space['key']}")
    print(f"  Name:   {space['name']}")
    print(f"  Type:   {space['type']}")
    print(f"  Status: {space.get('status', 'current')}")

    print('\n' + '!' * 50)
    print('  WARNING: This will permanently delete:')
    print('  - All pages in the space')
    print('  - All attachments')
    print('  - All comments')
    print('  - The space itself')
    print('  THIS CANNOT BE UNDONE!')
    print('!' * 50 + '\n')

    proceed = skip_confirm

    if not skip_confirm:
        answer = input(f"Type 'yes' to delete space {space_key}: ")
        proceed = answer.lower() in ('y', 'yes')

    if not proceed:
        print('\nDeletion cancelled.')
        sys.exit(0)

    try:
        print(f'\nDeleting space {space_key}...')
        delete_space(space_key)

        print('\nSpace deleted successfully!')
        print('(Note: Deletion may take a few moments to fully propagate)')

        print('\n' + '=' * 40)
        print('  RESULT')
        print('=' * 40)
        print(f'Space {space_key} has been deleted.')
        print('=' * 40 + '\n')

    except Exception as e:
        error_msg = str(e)
        if '403' in error_msg:
            print('Error: You do not have permission to delete this space.')
            print('Contact your Confluence administrator.')
        elif '404' in error_msg:
            print(f"Error: Space '{space_key}' not found (may have already been deleted).")
        else:
            print(f'Error deleting space: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
