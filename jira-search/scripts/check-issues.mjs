// Check where the issues are

// Load from environment variables (set by run.js or manually)
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;

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

async function jiraRequest(path, options = {}) {
  const url = `${JIRA_BASE_URL}/rest/api/3${path}`;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function main() {
  // Search for all SCRUM issues
  console.log('Searching for SCRUM issues...\n');

  // Use new search/jql endpoint
  const jql = encodeURIComponent('project = SCRUM ORDER BY created DESC');
  const result = await jiraRequest(`/search/jql?jql=${jql}&maxResults=60&fields=key,summary,status,created`);

  console.log(`Found ${result.total} issues:\n`);

  for (const issue of result.issues) {
    console.log(`${issue.key}: ${issue.fields.status.name} - ${issue.fields.summary.substring(0, 60)}...`);
    console.log(`  Link: ${JIRA_BASE_URL}/browse/${issue.key}`);
  }

  // Check board configuration
  console.log('\n\nChecking board 1...');
  try {
    const boardUrl = `${JIRA_BASE_URL}/rest/agile/1.0/board/1`;
    const boardResponse = await fetch(boardUrl, { headers });
    const board = await boardResponse.json();
    console.log(`Board: ${board.name} (${board.type})`);
    console.log(`Filter ID: ${board.filter?.id || 'N/A'}`);
  } catch (e) {
    console.log('Could not fetch board:', e.message);
  }

  // Check sprints
  console.log('\n\nChecking sprints...');
  try {
    const sprintsUrl = `${JIRA_BASE_URL}/rest/agile/1.0/board/1/sprint?state=active,future`;
    const sprintsResponse = await fetch(sprintsUrl, { headers });
    const sprints = await sprintsResponse.json();
    console.log(`Active/Future sprints: ${sprints.values?.length || 0}`);
    if (sprints.values) {
      for (const sprint of sprints.values) {
        console.log(`  - ${sprint.name} (${sprint.state})`);
      }
    }
  } catch (e) {
    console.log('Could not fetch sprints:', e.message);
  }

  // Direct links
  console.log('\n\n========================================');
  console.log('DIRECT LINKS TO ISSUES:');
  console.log('========================================');
  console.log(`\nBacklog view:\n${JIRA_BASE_URL}/jira/software/projects/SCRUM/boards/1/backlog`);
  console.log(`\nAll issues (JQL):\n${JIRA_BASE_URL}/issues/?jql=project%20%3D%20SCRUM`);
  console.log(`\nFirst issue:\n${JIRA_BASE_URL}/browse/SCRUM-1`);
  console.log(`\nLast issue:\n${JIRA_BASE_URL}/browse/SCRUM-51`);
}

main().catch(console.error);
