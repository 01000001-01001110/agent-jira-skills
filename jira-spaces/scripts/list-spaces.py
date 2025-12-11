#!/usr/bin/env python3
"""
List Confluence Spaces
Lists all accessible Confluence spaces.

Usage:
  python list-spaces.py
  python list-spaces.py --type global
  python list-spaces.py --limit 50
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
            if response.status == 204:
                return None
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'{e.code}: {error_body[:300]}')


def list_spaces(space_type=None, limit=25):
    """List Confluence spaces."""
    path = f'/space?limit={limit}&expand=description.plain'
    if space_type:
        path += f'&type={space_type}'

    return confluence_request(path)


def main():
    args = sys.argv[1:]
    space_type = None
    limit = 25

    # Parse arguments
    i = 0
    while i < len(args):
        if args[i] == '--type' and i + 1 < len(args):
            space_type = args[i + 1]
            i += 2
        elif args[i] == '--limit' and i + 1 < len(args):
            limit = int(args[i + 1])
            i += 2
        else:
            i += 1

    print('=' * 40)
    print('  LIST CONFLUENCE SPACES')
    print('=' * 40 + '\n')

    try:
        result = list_spaces(space_type, limit)

        if not result.get('results'):
            print('No spaces found.')
            return

        print(f"Found {result['size']} spaces:\n")

        # Table header
        print(f"{'Key':<12}{'Name':<40}{'Type':<12}Status")
        print('-' * 76)

        for space in result['results']:
            key = space['key'][:12].ljust(12)
            name = space['name']
            if len(name) > 38:
                name = name[:35] + '...'
            name = name.ljust(40)
            space_type_val = space['type'][:12].ljust(12)
            status = space.get('status', 'current')

            print(f"{key}{name}{space_type_val}{status}")

        print('-' * 76)
        print(f"Total: {result['size']} spaces")

        if result['size'] < result['limit']:
            print('(All spaces shown)')
        else:
            print(f"(Showing first {result['limit']}. Use --limit to see more)")

        print('\n' + '=' * 40)
        print('  QUICK ACCESS')
        print('=' * 40)
        if result['results']:
            first_space = result['results'][0]
            print(f"Example: {JIRA_BASE_URL}/wiki/spaces/{first_space['key']}")
        print('=' * 40 + '\n')

    except Exception as e:
        print(f'Error listing spaces: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
