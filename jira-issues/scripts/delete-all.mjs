// Delete all issues in SCRUM project
// WARNING: This permanently deletes all issues!

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

async function jiraRequest(path, options = {}) {
  const url = `${JIRA_BASE_URL}/rest/api/3${path}`;
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status}: ${error.substring(0, 200)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getAllIssues() {
  const jql = encodeURIComponent(`project = ${PROJECT_KEY} ORDER BY key ASC`);
  const result = await jiraRequest(`/search/jql?jql=${jql}&maxResults=100&fields=key,summary,issuetype`);
  return result.issues || [];
}

async function deleteIssue(issueKey) {
  const url = `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}?deleteSubtasks=true`;
  const response = await fetch(url, { method: 'DELETE', headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete ${issueKey}: ${error.substring(0, 100)}`);
  }

  return true;
}

async function main() {
  console.log('========================================');
  console.log('  DELETE ALL ISSUES IN PROJECT');
  console.log('========================================\n');
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Base URL: ${JIRA_BASE_URL}\n`);

  // Get all issues
  console.log('Fetching all issues...');
  const issues = await getAllIssues();
  console.log(`Found ${issues.length} issues to delete\n`);

  if (issues.length === 0) {
    console.log('No issues to delete.');
    return;
  }

  // Confirm deletion
  console.log('Issues to delete:');
  for (const issue of issues.slice(0, 10)) {
    console.log(`  - ${issue.key}: ${issue.fields.issuetype.name} - ${issue.fields.summary.substring(0, 50)}...`);
  }
  if (issues.length > 10) {
    console.log(`  ... and ${issues.length - 10} more`);
  }

  console.log('\n--- STARTING DELETION ---\n');

  const results = { deleted: [], failed: [] };

  // Delete in reverse order (highest key first to handle subtasks)
  const sortedIssues = [...issues].reverse();

  for (const issue of sortedIssues) {
    try {
      await deleteIssue(issue.key);
      console.log(`Deleted: ${issue.key}`);
      results.deleted.push(issue.key);
    } catch (error) {
      console.log(`Failed: ${issue.key} - ${error.message}`);
      results.failed.push({ key: issue.key, error: error.message });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`Deleted: ${results.deleted.length}/${issues.length}`);

  if (results.failed.length > 0) {
    console.log(`\nFailed to delete: ${results.failed.length}`);
    results.failed.forEach(f => console.log(`  - ${f.key}: ${f.error}`));
  }

  console.log('\n========================================');
}

main().catch(console.error);
