#!/usr/bin/env node
/**
 * Create Confluence Space
 * Creates a new Confluence space for documentation.
 *
 * Usage:
 *   node run.js create-space KEY "Space Name"
 *   node run.js create-space KEY "Space Name" "Description"
 *
 * Example:
 *   node run.js create-space DOCS "Project Documentation" "Technical docs and guides"
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

  if (response.status === 204 || response.status === 202) return null;
  return response.json();
}

async function createSpace(key, name, description = '') {
  const data = {
    key: key.toUpperCase(),
    name: name,
    type: 'global'
  };

  if (description) {
    data.description = {
      plain: {
        value: description,
        representation: 'plain'
      }
    };
  }

  return confluenceRequest('/space', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

function showUsage() {
  console.log(`
Create Confluence Space

Usage:
  node run.js create-space KEY "Space Name"
  node run.js create-space KEY "Space Name" "Description"

Arguments:
  KEY         Space key (uppercase letters/numbers, no spaces)
  Name        Display name for the space
  Description Optional description

Examples:
  node run.js create-space DOCS "Project Documentation"
  node run.js create-space TUSTLE "Tustle Docs" "Technical documentation for Tustle MVP"
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  const spaceKey = args[0].toUpperCase();
  const spaceName = args[1];
  const description = args[2] || '';

  // Validate space key
  if (!/^[A-Z][A-Z0-9]*$/.test(spaceKey)) {
    console.error('Error: Space key must start with a letter and contain only uppercase letters and numbers.');
    console.error('Example: DOCS, PROJ, TUSTLE');
    process.exit(1);
  }

  console.log('========================================');
  console.log('  CREATE CONFLUENCE SPACE');
  console.log('========================================\n');

  console.log(`Creating space:`);
  console.log(`  Key:         ${spaceKey}`);
  console.log(`  Name:        ${spaceName}`);
  if (description) {
    console.log(`  Description: ${description}`);
  }
  console.log('');

  try {
    const space = await createSpace(spaceKey, spaceName, description);

    console.log('Space created successfully!\n');
    console.log('========================================');
    console.log('  DETAILS');
    console.log('========================================');
    console.log(`Key:    ${space.key}`);
    console.log(`Name:   ${space.name}`);
    console.log(`Type:   ${space.type}`);
    console.log(`ID:     ${space.id}`);
    console.log(`Status: ${space.status || 'current'}`);

    console.log('\n========================================');
    console.log('  LINKS');
    console.log('========================================');
    console.log(`Web:    ${JIRA_BASE_URL}/wiki/spaces/${space.key}`);
    console.log(`API:    ${JIRA_BASE_URL}/wiki/rest/api/space/${space.key}`);
    console.log('========================================\n');

  } catch (error) {
    if (error.message.includes('409')) {
      console.error(`Error: Space with key '${spaceKey}' already exists.`);
      console.error('Please choose a different space key.');
    } else if (error.message.includes('403')) {
      console.error('Error: You do not have permission to create spaces.');
      console.error('Contact your Confluence administrator.');
    } else {
      console.error(`Error creating space: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
