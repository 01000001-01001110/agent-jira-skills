// Create one test story in backlog

// Load from environment variables (set by run.js or manually)
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SCRUM';

// Validate required env vars
if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_BASE_URL) {
  console.error('Error: Missing required environment variables.');
  console.error('Required: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL');
  console.error('Set these in .claude/skills/jira/.env or export them manually.');
  process.exit(1);
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

const headers = {
  'Authorization': `Basic ${auth}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

async function main() {
  console.log('Creating test story in backlog...\n');

  const body = {
    fields: {
      project: { key: PROJECT_KEY },
      summary: 'Test Story - Backlog Visibility Test',
      issuetype: { name: 'Story' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'This is a test story to verify backlog visibility.' }],
          },
        ],
      },
    },
  };

  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to create:', error);
    return;
  }

  const issue = await response.json();

  console.log('✓ Story created successfully!\n');
  console.log(`Key: ${issue.key}`);
  console.log(`ID: ${issue.id}`);
  console.log(`\nDirect link: ${JIRA_BASE_URL}/browse/${issue.key}`);
  console.log(`\nBacklog: ${JIRA_BASE_URL}/jira/software/projects/SCRUM/boards/1/backlog`);

  // Get issue details to confirm status
  const detailsResponse = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issue.key}?fields=status`, { headers });
  const details = await detailsResponse.json();
  console.log(`\nStatus: ${details.fields.status.name}`);
}

main().catch(console.error);
