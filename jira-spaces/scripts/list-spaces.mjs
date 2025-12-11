#!/usr/bin/env node
/**
 * List Confluence Spaces
 * Lists all accessible Confluence spaces.
 *
 * Usage:
 *   node run.js list-spaces
 *   node run.js list-spaces --type global
 *   node run.js list-spaces --limit 50
 */

const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;

if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_BASE_URL) {
  console.error('Error: Missing required environment variables.');
  console.error('Required: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL');
  process.exit(1);
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

const headers = {
  'Authorization': `Basic ${auth}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

async function confluenceRequest(path, options = {}) {
  const url = `${JIRA_BASE_URL}/wiki/rest/api${path}`;
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error.substring(0, 300)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function listSpaces(type = null, limit = 25) {
  let path = `/space?limit=${limit}&expand=description.plain`;
  if (type) {
    path += `&type=${type}`;
  }

  return confluenceRequest(path);
}

async function main() {
  const args = process.argv.slice(2);
  let type = null;
  let limit = 25;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && args[i + 1]) {
      type = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    }
  }

  console.log('========================================');
  console.log('  LIST CONFLUENCE SPACES');
  console.log('========================================\n');

  try {
    const result = await listSpaces(type, limit);

    if (!result.results || result.results.length === 0) {
      console.log('No spaces found.');
      return;
    }

    console.log(`Found ${result.size} spaces:\n`);

    // Table header
    console.log('Key'.padEnd(12) + 'Name'.padEnd(40) + 'Type'.padEnd(12) + 'Status');
    console.log('-'.repeat(76));

    for (const space of result.results) {
      const key = space.key.padEnd(12);
      const name = (space.name.length > 38 ? space.name.substring(0, 35) + '...' : space.name).padEnd(40);
      const spaceType = space.type.padEnd(12);
      const status = space.status || 'current';

      console.log(`${key}${name}${spaceType}${status}`);
    }

    console.log('-'.repeat(76));
    console.log(`Total: ${result.size} spaces`);

    if (result.size < result.limit) {
      console.log('(All spaces shown)');
    } else {
      console.log(`(Showing first ${result.limit}. Use --limit to see more)`);
    }

    console.log('\n========================================');
    console.log('  QUICK ACCESS');
    console.log('========================================');
    if (result.results.length > 0) {
      const firstSpace = result.results[0];
      console.log(`Example: ${JIRA_BASE_URL}/wiki/spaces/${firstSpace.key}`);
    }
    console.log('========================================\n');

  } catch (error) {
    console.error(`Error listing spaces: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
