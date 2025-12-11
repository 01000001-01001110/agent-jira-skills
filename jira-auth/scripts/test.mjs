// Jira Skills Test Script
// Tests authentication, issue creation, and transitions

// Load from environment variables (set by run.js or manually)
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'SCRUM';

// Validate required env vars
if (!JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_BASE_URL) {
  console.error('Error: Missing required environment variables.');
  console.error('Required: JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL');
  console.error('Optional: JIRA_PROJECT_KEY (defaults to SCRUM)');
  console.error('\nSet these in .claude/skills/jira/.env or export them manually.');
  process.exit(1);
}

// Debug: Show auth details
console.log('Debug: Email length:', JIRA_EMAIL.length);
console.log('Debug: Token length:', JIRA_API_TOKEN.length);
console.log('Debug: Token starts with:', JIRA_API_TOKEN.substring(0, 10));
console.log('Debug: Token ends with:', JIRA_API_TOKEN.substring(JIRA_API_TOKEN.length - 10));

// Create auth header - using standard Basic Auth format
const credentials = `${JIRA_EMAIL}:${JIRA_API_TOKEN}`;
const auth = Buffer.from(credentials).toString('base64');
console.log('Debug: Auth header length:', auth.length);
console.log('Debug: Auth header preview:', auth.substring(0, 50) + '...');

const headers = {
  'Authorization': `Basic ${auth}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// API request helper
async function jiraRequest(path, options = {}) {
  const url = `${JIRA_BASE_URL}/rest/api/3${path}`;
  console.log(`\nRequest: ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  console.log(`Response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const error = await response.text();
    console.log('Error body:', error.substring(0, 500));
    throw new Error(`Jira API error ${response.status}: ${error.substring(0, 200)}`);
  }

  // 204 No Content returns empty
  if (response.status === 204) return null;

  return response.json();
}

// Test 1: Authentication
async function testAuth() {
  console.log('\n=== Test 1: Authentication ===');
  try {
    const user = await jiraRequest('/myself');
    console.log(`✓ Authenticated as: ${user.displayName} (${user.emailAddress})`);
    console.log(`  Account ID: ${user.accountId}`);
    return user;
  } catch (error) {
    console.error('✗ Authentication failed:', error.message);
    throw error;
  }
}

// Test 2: Get Project
async function testProject() {
  console.log('\n=== Test 2: Get Project ===');
  try {
    const project = await jiraRequest(`/project/${PROJECT_KEY}`);
    console.log(`✓ Project: ${project.name} (${project.key})`);
    console.log(`  Type: ${project.projectTypeKey}`);
    console.log(`  ID: ${project.id}`);
    return project;
  } catch (error) {
    console.error('✗ Get project failed:', error.message);
    throw error;
  }
}

// Test 3: Get Issue Types
async function testIssueTypes() {
  console.log('\n=== Test 3: Get Issue Types ===');
  try {
    const project = await jiraRequest(`/project/${PROJECT_KEY}`);
    const issueTypes = await jiraRequest(`/issuetype/project?projectId=${project.id}`);
    console.log(`✓ Found ${issueTypes.length} issue types:`);
    for (const type of issueTypes.slice(0, 5)) {
      console.log(`  - ${type.name} (${type.id})`);
    }
    return issueTypes;
  } catch (error) {
    console.error('✗ Get issue types failed:', error.message);
    throw error;
  }
}

// Test 4: Create Issue
async function testCreateIssue(summary, description) {
  console.log('\n=== Test 4: Create Issue ===');
  try {
    const body = {
      fields: {
        project: { key: PROJECT_KEY },
        summary: summary,
        issuetype: { name: 'Story' },
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: description }],
            },
          ],
        },
      },
    };

    const issue = await jiraRequest('/issue', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    console.log(`✓ Created issue: ${issue.key}`);
    console.log(`  URL: ${JIRA_BASE_URL}/browse/${issue.key}`);
    return issue;
  } catch (error) {
    console.error('✗ Create issue failed:', error.message);
    throw error;
  }
}

// Test 5: Get Transitions
async function testGetTransitions(issueKey) {
  console.log('\n=== Test 5: Get Transitions ===');
  try {
    const response = await jiraRequest(`/issue/${issueKey}/transitions?expand=transitions.fields`);
    console.log(`✓ Found ${response.transitions.length} transitions:`);
    for (const t of response.transitions) {
      console.log(`  - ${t.id}: ${t.name} → ${t.to.name}`);
    }
    return response.transitions;
  } catch (error) {
    console.error('✗ Get transitions failed:', error.message);
    throw error;
  }
}

// Test 6: Transition Issue to Done
async function testTransitionToDone(issueKey, transitions) {
  console.log('\n=== Test 6: Transition to Done ===');
  try {
    // Find Done transition
    const doneTransition = transitions.find(
      t => t.to.name.toLowerCase() === 'done' || t.name.toLowerCase() === 'done'
    );

    if (!doneTransition) {
      console.log('✗ No "Done" transition found. Available:');
      transitions.forEach(t => console.log(`  - ${t.name} → ${t.to.name}`));
      return false;
    }

    console.log(`  Using transition: ${doneTransition.id} (${doneTransition.name})`);

    const body = {
      transition: { id: doneTransition.id },
    };

    // Check if resolution is required
    if (doneTransition.fields?.resolution?.required) {
      body.fields = { resolution: { name: 'Done' } };
    }

    await jiraRequest(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    console.log(`✓ Issue ${issueKey} transitioned to Done`);
    return true;
  } catch (error) {
    console.error('✗ Transition failed:', error.message);
    throw error;
  }
}

// Test 7: Verify Issue Status
async function testVerifyStatus(issueKey) {
  console.log('\n=== Test 7: Verify Status ===');
  try {
    const issue = await jiraRequest(`/issue/${issueKey}?fields=status`);
    console.log(`✓ Issue ${issueKey} status: ${issue.fields.status.name}`);
    return issue.fields.status.name;
  } catch (error) {
    console.error('✗ Verify failed:', error.message);
    throw error;
  }
}

// Main test runner
async function runTests() {
  console.log('========================================');
  console.log('  JIRA SKILLS TEST SUITE');
  console.log('========================================');
  console.log(`Base URL: ${JIRA_BASE_URL}`);
  console.log(`Project: ${PROJECT_KEY}`);

  try {
    // Run tests
    await testAuth();
    await testProject();
    await testIssueTypes();

    // Create a test issue from a commit
    const testCommit = 'fix(scripts): add client creation before brand in smoke test setup';
    const issue = await testCreateIssue(
      `[Test] ${testCommit}`,
      `Automated issue created from git commit: ${testCommit}\n\nThis is a test of the Jira skills implementation.`
    );

    // Get available transitions
    const transitions = await testGetTransitions(issue.key);

    // Transition to Done
    await testTransitionToDone(issue.key, transitions);

    // Verify final status
    await testVerifyStatus(issue.key);

    console.log('\n========================================');
    console.log('  ALL TESTS PASSED ✓');
    console.log('========================================');

    return { success: true, issueKey: issue.key };
  } catch (error) {
    console.log('\n========================================');
    console.log('  TESTS FAILED ✗');
    console.log(`  Error: ${error.message}`);
    console.log('========================================');
    return { success: false, error: error.message };
  }
}

// Run tests
runTests().then(result => {
  process.exit(result.success ? 0 : 1);
});
