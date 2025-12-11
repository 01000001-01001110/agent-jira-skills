#!/usr/bin/env node
/**
 * Delete Confluence Space
 * Deletes a Confluence space and all its content.
 *
 * WARNING: This permanently deletes all pages in the space!
 *
 * Usage:
 *   node run.js delete-space KEY              (interactive confirmation)
 *   node run.js delete-space KEY --confirm    (skip confirmation)
 *
 * Example:
 *   node run.js delete-space DOCS
 *   node run.js delete-space DOCS --confirm
 */

import * as readline from 'readline';

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

async function getSpace(key) {
  try {
    return await confluenceRequest(`/space/${key}?expand=description.plain`);
  } catch {
    return null;
  }
}

async function deleteSpace(key) {
  return confluenceRequest(`/space/${key}`, { method: 'DELETE' });
}

function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function showUsage() {
  console.log(`
Delete Confluence Space

WARNING: This permanently deletes a space and ALL its content!

Usage:
  node run.js delete-space KEY              (interactive confirmation)
  node run.js delete-space KEY --confirm    (skip confirmation)

Arguments:
  KEY       Space key to delete
  --confirm Skip interactive confirmation (use with caution!)

Examples:
  node run.js delete-space DOCS
  node run.js delete-space TEMP --confirm
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
    showUsage();
    process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
  }

  const spaceKey = args[0].toUpperCase();
  const skipConfirm = args.includes('--confirm');

  console.log('========================================');
  console.log('  DELETE CONFLUENCE SPACE');
  console.log('========================================\n');

  // First, check if space exists
  console.log(`Looking up space ${spaceKey}...`);
  const space = await getSpace(spaceKey);

  if (!space) {
    console.error(`Error: Space '${spaceKey}' not found.`);
    process.exit(1);
  }

  console.log('\nSpace found:');
  console.log(`  Key:    ${space.key}`);
  console.log(`  Name:   ${space.name}`);
  console.log(`  Type:   ${space.type}`);
  console.log(`  Status: ${space.status || 'current'}`);

  console.log('\n' + '!'.repeat(50));
  console.log('  WARNING: This will permanently delete:');
  console.log('  - All pages in the space');
  console.log('  - All attachments');
  console.log('  - All comments');
  console.log('  - The space itself');
  console.log('  THIS CANNOT BE UNDONE!');
  console.log('!'.repeat(50) + '\n');

  let proceed = skipConfirm;

  if (!skipConfirm) {
    proceed = await askConfirmation(`Type 'yes' to delete space ${spaceKey}: `);
  }

  if (!proceed) {
    console.log('\nDeletion cancelled.');
    process.exit(0);
  }

  try {
    console.log(`\nDeleting space ${spaceKey}...`);
    await deleteSpace(spaceKey);

    console.log('\nSpace deleted successfully!');
    console.log('(Note: Deletion may take a few moments to fully propagate)');

    console.log('\n========================================');
    console.log('  RESULT');
    console.log('========================================');
    console.log(`Space ${spaceKey} has been deleted.`);
    console.log('========================================\n');

  } catch (error) {
    if (error.message.includes('403')) {
      console.error('Error: You do not have permission to delete this space.');
      console.error('Contact your Confluence administrator.');
    } else if (error.message.includes('404')) {
      console.error(`Error: Space '${spaceKey}' not found (may have already been deleted).`);
    } else {
      console.error(`Error deleting space: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
