// Jira Workflow Demo: Backlog -> In Progress -> Done
// Demonstrates the complete workflow cycle

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

// ==================== API HELPERS ====================

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

async function getIssueStatus(issueKey) {
  const issue = await jiraRequest(`/issue/${issueKey}?fields=status`);
  return issue.fields.status.name;
}

async function getTransitions(issueKey) {
  const response = await jiraRequest(`/issue/${issueKey}/transitions`);
  return response.transitions;
}

async function transitionTo(issueKey, targetState) {
  const transitions = await getTransitions(issueKey);

  const transition = transitions.find(t =>
    t.to.name.toLowerCase() === targetState.toLowerCase() ||
    t.name.toLowerCase() === targetState.toLowerCase()
  );

  if (!transition) {
    console.log(`Available transitions for ${issueKey}:`);
    transitions.forEach(t => console.log(`  - ${t.id}: ${t.name} → ${t.to.name}`));
    throw new Error(`No transition to "${targetState}" found`);
  }

  await jiraRequest(`/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: transition.id } })
  });

  return transition.to.name;
}

async function addComment(issueKey, text) {
  const body = {
    body: {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
    }
  };

  await jiraRequest(`/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

// ==================== WORKFLOW OPERATIONS ====================

async function startWork(issueKey) {
  console.log(`\nStarting work on ${issueKey}...`);

  const beforeStatus = await getIssueStatus(issueKey);
  console.log(`  Current status: ${beforeStatus}`);

  if (beforeStatus.toLowerCase() === 'progressing') {
    console.log(`  Already progressing, skipping transition`);
    return beforeStatus;
  }

  const newStatus = await transitionTo(issueKey, 'Progressing');
  console.log(`  Transitioned to: ${newStatus}`);

  await addComment(issueKey, `Work started at ${new Date().toISOString()}`);
  console.log(`  Added start comment`);

  return newStatus;
}

async function completeWork(issueKey, details = {}) {
  console.log(`\nCompleting work on ${issueKey}...`);

  const beforeStatus = await getIssueStatus(issueKey);
  console.log(`  Current status: ${beforeStatus}`);

  if (beforeStatus.toLowerCase() === 'done') {
    console.log(`  Already done, skipping transition`);
    return beforeStatus;
  }

  const newStatus = await transitionTo(issueKey, 'Done');
  console.log(`  Transitioned to: ${newStatus}`);

  // Add completion comment
  let commentText = `Work completed at ${new Date().toISOString()}`;
  if (details.files) {
    commentText += `\n\nFiles modified:\n${details.files.map(f => `- ${f}`).join('\n')}`;
  }
  if (details.commits) {
    commentText += `\n\nCommits:\n${details.commits.map(c => `- ${c}`).join('\n')}`;
  }
  if (details.notes) {
    commentText += `\n\nNotes: ${details.notes}`;
  }

  await addComment(issueKey, commentText);
  console.log(`  Added completion comment`);

  return newStatus;
}

async function reopenWork(issueKey) {
  console.log(`\nReopening ${issueKey}...`);

  const beforeStatus = await getIssueStatus(issueKey);
  console.log(`  Current status: ${beforeStatus}`);

  const newStatus = await transitionTo(issueKey, 'To Do');
  console.log(`  Transitioned to: ${newStatus}`);

  await addComment(issueKey, `Reopened at ${new Date().toISOString()}`);

  return newStatus;
}

// ==================== DEMO WORKFLOW ====================

async function demoWorkflow(issueKey) {
  console.log('========================================');
  console.log('  JIRA WORKFLOW DEMO');
  console.log('========================================\n');
  console.log(`Issue: ${issueKey}`);
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`URL: ${JIRA_BASE_URL}/browse/${issueKey}\n`);

  // 1. Check current status
  console.log('--- Step 1: Check Current Status ---');
  const initialStatus = await getIssueStatus(issueKey);
  console.log(`Initial status: ${initialStatus}\n`);

  // 2. Show available transitions
  console.log('--- Step 2: Available Transitions ---');
  const transitions = await getTransitions(issueKey);
  console.log(`Found ${transitions.length} transitions:`);
  for (const t of transitions) {
    console.log(`  - ${t.id}: "${t.name}" → ${t.to.name}`);
  }
  console.log('');

  // 3. Start work (move to In Progress)
  console.log('--- Step 3: Start Work ---');
  await startWork(issueKey);

  // 4. Simulate doing work
  console.log('\n--- Step 4: Simulating Work ---');
  console.log('  [Simulating development work...]');
  await new Promise(r => setTimeout(r, 1000));
  console.log('  [Work complete!]\n');

  // 5. Complete work (move to Done)
  console.log('--- Step 5: Complete Work ---');
  await completeWork(issueKey, {
    files: ['app/api/example/route.ts', 'lib/utils/helper.ts'],
    commits: ['abc1234 - feat: implement feature', 'def5678 - test: add tests'],
    notes: 'Demo workflow completed successfully'
  });

  // 6. Final status
  console.log('\n--- Step 6: Final Status ---');
  const finalStatus = await getIssueStatus(issueKey);
  console.log(`Final status: ${finalStatus}`);

  console.log('\n========================================');
  console.log('  WORKFLOW DEMO COMPLETE');
  console.log('========================================');
  console.log(`\nView issue: ${JIRA_BASE_URL}/browse/${issueKey}`);

  return { initialStatus, finalStatus };
}

// ==================== BATCH WORKFLOW ====================

async function batchWorkflow(issueKeys, operation) {
  console.log('========================================');
  console.log(`  BATCH ${operation.toUpperCase()}`);
  console.log('========================================\n');
  console.log(`Processing ${issueKeys.length} issues...\n`);

  const results = { success: [], failed: [] };

  for (const key of issueKeys) {
    try {
      if (operation === 'start') {
        await startWork(key);
      } else if (operation === 'complete') {
        await completeWork(key);
      } else if (operation === 'reopen') {
        await reopenWork(key);
      }
      results.success.push(key);
    } catch (error) {
      console.log(`  FAILED ${key}: ${error.message}`);
      results.failed.push({ key, error: error.message });
    }

    await new Promise(r => setTimeout(r, 200)); // Rate limiting
  }

  console.log('\n========================================');
  console.log('  BATCH COMPLETE');
  console.log('========================================');
  console.log(`Success: ${results.success.length}`);
  console.log(`Failed: ${results.failed.length}`);

  return results;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node jira-workflow-demo.mjs demo SCRUM-55');
    console.log('  node jira-workflow-demo.mjs start SCRUM-55');
    console.log('  node jira-workflow-demo.mjs complete SCRUM-55');
    console.log('  node jira-workflow-demo.mjs reopen SCRUM-55');
    console.log('  node jira-workflow-demo.mjs batch-start SCRUM-55 SCRUM-56 SCRUM-57');
    console.log('  node jira-workflow-demo.mjs batch-complete SCRUM-55 SCRUM-56 SCRUM-57');
    console.log('  node jira-workflow-demo.mjs status SCRUM-55');
    return;
  }

  const command = args[0];
  const issueKeys = args.slice(1);

  switch (command) {
    case 'demo':
      await demoWorkflow(issueKeys[0] || 'SCRUM-55');
      break;

    case 'start':
      await startWork(issueKeys[0]);
      break;

    case 'complete':
      await completeWork(issueKeys[0]);
      break;

    case 'reopen':
      await reopenWork(issueKeys[0]);
      break;

    case 'batch-start':
      await batchWorkflow(issueKeys, 'start');
      break;

    case 'batch-complete':
      await batchWorkflow(issueKeys, 'complete');
      break;

    case 'status':
      const status = await getIssueStatus(issueKeys[0]);
      console.log(`${issueKeys[0]}: ${status}`);
      break;

    default:
      console.log(`Unknown command: ${command}`);
  }
}

main().catch(console.error);
