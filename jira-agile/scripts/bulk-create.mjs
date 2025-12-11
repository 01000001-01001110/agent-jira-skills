// Jira Bulk Issue Creator
// Creates stories from git commits and transitions them to Done

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

// Commits from git log
const commits = [
  { hash: '4ca4834e', message: 'fix(scripts): add client creation before brand in smoke test setup' },
  { hash: '872b9d63', message: 'fix(test): correct subscription plan and status type definitions' },
  { hash: '9f2cce48', message: 'fix(test): add missing primaryOffering field in E2E global setup' },
  { hash: '2194372a', message: 'docs: add frontend UI implementation documentation' },
  { hash: '40f16684', message: 'feat(ui): add client selector and management UI' },
  { hash: 'b45bd9bf', message: 'docs: add E2E Phase 1 setup and summary documentation' },
  { hash: 'ce4d1377', message: 'feat(db): enforce database constraints for two-level hierarchy' },
  { hash: '36c17fcf', message: 'feat(test): implement E2E testing foundation - Phase 1' },
  { hash: '0a91ac85', message: 'feat(api): add client CRUD endpoints with subscription limits' },
  { hash: 'a4ed944f', message: 'docs(epic): add comprehensive implementation plans for US-001.4, US-002.1, Frontend UI, and E2E testing' },
  { hash: '16058557', message: 'fix(scripts): remove invalid description field from brands insert' },
  { hash: '5c6adfe2', message: 'fix(scripts): correct all Drizzle insert operations in smoke test setup' },
  { hash: '00de9bea', message: 'fix(scripts): add schema to Drizzle instance in smoke test setup' },
  { hash: '10bcc812', message: 'docs: add ultra orchestration methodology to CLAUDE.md' },
  { hash: 'e80a6284', message: 'docs: update HANDOFF with ultra orchestration methodology and US-001.2 analysis' },
  { hash: 'f4d195da', message: 'docs: add comprehensive smoke tests and integration tests validation reports' },
  { hash: 'beb99f02', message: 'docs: add integration test documentation summaries' },
  { hash: '7150aa7f', message: 'docs: add executive validation report for US-001.3' },
  { hash: '7d596667', message: 'docs: create HANDOFF for US-001.3 validation session' },
  { hash: '166f5d7e', message: 'docs(epic): validate US-001.3 current status - migration complete with acceptable variance' },
  { hash: '6e7feb0b', message: 'feat(test): add integration test suite foundation with database relations tests' },
  { hash: 'b0255603', message: 'feat(ci): finalize production smoke tests implementation' },
  { hash: '68f1be35', message: 'docs: add comprehensive PR template documentation index' },
  { hash: '30f3e511', message: 'docs: add PR template delivery summary' },
  { hash: '4b42c8a4', message: 'docs: create comprehensive EPIC-001 continuation plan and execution guides' },
  { hash: 'd664649c', message: 'docs: add PR template deployment guide and one-page checklist' },
  { hash: 'fd4f9d28', message: 'docs: create comprehensive PR template with manual testing checklist' },
  { hash: 'ced1d241', message: 'docs: add US-001.2 production failure incident to CHANGELOG' },
  { hash: '799f7dc2', message: 'fix(critical): apply missing migration to production + create deployment safeguards' },
  { hash: '6eaf21f1', message: 'docs: add comprehensive postmortem for US-001.2 production failure' },
  { hash: '38a82eff', message: 'docs: add hotfix documentation for clientId relation fix' },
  { hash: '636dd29c', message: 'fix(brands): add missing clientId relation and auto-create default client' },
  { hash: '0ab87145', message: 'docs: update HANDOFF and CHANGELOG for US-001.1 & US-001.2 completion' },
  { hash: '12fe2a0e', message: 'feat(db): US-001.2 - Add client_id column to brands table' },
  { hash: '738c5c4e', message: 'feat(db): US-001.1 - Create Clients Table with complete test coverage' },
  { hash: '2a1f8161', message: 'feat(billing): handle waived accounts in billing UI' },
  { hash: 'b1f725e1', message: 'feat(ui): add animated thinking indicator while waiting for AI' },
  { hash: 'c841e787', message: 'fix(ai): add reasoning_effort param for gpt-5-nano reasoning model' },
  { hash: '00189b34', message: 'fix(ai): remove temperature param - gpt-5-nano does not support it' },
  { hash: 'c1266dfc', message: 'docs: update HANDOFF with model restoration and latest deployment' },
  { hash: 'da45387f', message: 'revert: restore gpt-5-nano-2025-08-07 model' },
  { hash: '0698e39a', message: 'fix(ai): switch to gpt-4o-mini - gpt-5-nano may require special API access' },
  { hash: '3eb9b090', message: 'docs: update CHANGELOG with agent analysis and v2 route fix' },
  { hash: '24ad7ce2', message: 'docs: update HANDOFF with edge cache bypass solution' },
  { hash: '5786ff79', message: 'fix(ai): add regenerate-v2 endpoint to bypass edge function cache' },
  { hash: '0fc690b7', message: 'fix(ai): enhanced error logging + force fresh build timestamp' },
  { hash: 'cbe1dcfd', message: 'docs: update HANDOFF - regeneration fix deployed and serving' },
  { hash: 'a7d56d66', message: 'docs: update CHANGELOG and HANDOFF with deployment issue context' },
  { hash: 'cd6ace84', message: 'fix(ai): change max_tokens to max_completion_tokens for gpt-5-nano' },
  { hash: '7bad3fb5', message: 'Add 1Password skills for authentication, Connect server management, and item operations' },
];

async function jiraRequest(path, options = {}) {
  const url = `${JIRA_BASE_URL}/rest/api/3${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira API error ${response.status}: ${error.substring(0, 200)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function createIssue(commit) {
  const body = {
    fields: {
      project: { key: PROJECT_KEY },
      summary: commit.message.substring(0, 255),
      issuetype: { name: 'Story' },
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `Git commit: ${commit.hash}` },
            ],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: commit.message },
            ],
          },
        ],
      },
    },
  };

  return jiraRequest('/issue', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function transitionToDone(issueKey) {
  // Get transitions
  const { transitions } = await jiraRequest(`/issue/${issueKey}/transitions`);
  const doneTransition = transitions.find(t => t.to.name.toLowerCase() === 'done' || t.name.toLowerCase() === 'done');

  if (!doneTransition) {
    console.log(`  Warning: No Done transition for ${issueKey}`);
    return false;
  }

  await jiraRequest(`/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: doneTransition.id } }),
  });

  return true;
}

async function main() {
  console.log('========================================');
  console.log('  BULK ISSUE CREATION FROM COMMITS');
  console.log('========================================\n');
  console.log(`Creating ${commits.length} issues in project ${PROJECT_KEY}\n`);

  const results = {
    created: [],
    failed: [],
    transitioned: [],
    transitionFailed: [],
  };

  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < commits.length; i += batchSize) {
    const batch = commits.slice(i, i + batchSize);
    console.log(`\n--- Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(commits.length / batchSize)} ---`);

    for (const commit of batch) {
      try {
        // Create issue
        const issue = await createIssue(commit);
        console.log(`✓ Created ${issue.key}: ${commit.message.substring(0, 50)}...`);
        results.created.push({ key: issue.key, commit });

        // Transition to Done
        try {
          await transitionToDone(issue.key);
          console.log(`  → ${issue.key} transitioned to Done`);
          results.transitioned.push(issue.key);
        } catch (error) {
          console.log(`  ✗ Failed to transition ${issue.key}: ${error.message}`);
          results.transitionFailed.push(issue.key);
        }
      } catch (error) {
        console.log(`✗ Failed to create: ${commit.hash} - ${error.message}`);
        results.failed.push({ commit, error: error.message });
      }
    }

    // Small delay between batches
    if (i + batchSize < commits.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`Created: ${results.created.length}/${commits.length}`);
  console.log(`Transitioned to Done: ${results.transitioned.length}/${results.created.length}`);

  if (results.failed.length > 0) {
    console.log(`\nFailed to create: ${results.failed.length}`);
    results.failed.forEach(f => console.log(`  - ${f.commit.hash}: ${f.error}`));
  }

  if (results.transitionFailed.length > 0) {
    console.log(`\nFailed to transition: ${results.transitionFailed.length}`);
    results.transitionFailed.forEach(key => console.log(`  - ${key}`));
  }

  console.log('\n========================================');
  console.log(`  View issues: ${JIRA_BASE_URL}/browse/${PROJECT_KEY}`);
  console.log('========================================');

  return results;
}

main().catch(console.error);
