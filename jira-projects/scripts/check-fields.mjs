// Check available fields and link types in Jira

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
  console.log('=== Checking Jira Project Configuration ===\n');

  // 1. Check project type
  console.log('1. PROJECT INFO:');
  const projectRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/project/${PROJECT_KEY}`, { headers });
  const project = await projectRes.json();
  console.log(`   Name: ${project.name}`);
  console.log(`   Type: ${project.projectTypeKey}`);
  console.log(`   Style: ${project.style || 'classic'}`);
  console.log(`   Simplified: ${project.simplified || false}\n`);

  // 2. Check issue types
  console.log('2. ISSUE TYPES:');
  const issueTypesRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issuetype/project?projectId=${project.id}`, { headers });
  const issueTypes = await issueTypesRes.json();
  for (const type of issueTypes) {
    console.log(`   - ${type.name} (${type.id}) - ${type.subtask ? 'subtask' : 'standard'}`);
  }
  console.log('');

  // 3. Check link types
  console.log('3. LINK TYPES:');
  const linkTypesRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/issueLinkType`, { headers });
  const { issueLinkTypes } = await linkTypesRes.json();
  for (const lt of issueLinkTypes) {
    console.log(`   - ${lt.name} (${lt.id})`);
    console.log(`     Inward: "${lt.inward}"`);
    console.log(`     Outward: "${lt.outward}"`);
  }
  console.log('');

  // 4. Check fields on Story issue type
  console.log('4. FIELDS ON STORY (create screen):');
  const createMetaRes = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/issue/createmeta?projectKeys=${PROJECT_KEY}&issuetypeNames=Story&expand=projects.issuetypes.fields`,
    { headers }
  );
  const createMeta = await createMetaRes.json();
  if (createMeta.projects && createMeta.projects[0]) {
    const storyType = createMeta.projects[0].issuetypes?.find(t => t.name === 'Story');
    if (storyType?.fields) {
      const fieldNames = Object.entries(storyType.fields)
        .map(([key, val]) => `${key}: ${val.name}${val.required ? ' (required)' : ''}`);
      console.log('   Available on create screen:');
      fieldNames.forEach(f => console.log(`   - ${f}`));
    }
  }
  console.log('');

  // 5. Check if parent field is available for Stories (Next-Gen projects)
  console.log('5. CHECKING PARENT FIELD:');
  const fieldsRes = await fetch(`${JIRA_BASE_URL}/rest/api/3/field`, { headers });
  const fields = await fieldsRes.json();
  const parentField = fields.find(f => f.id === 'parent');
  const epicLinkField = fields.find(f => f.name === 'Epic Link' || f.id === 'customfield_10014');
  console.log(`   Parent field: ${parentField ? 'EXISTS' : 'NOT FOUND'}`);
  console.log(`   Epic Link field: ${epicLinkField ? `EXISTS (${epicLinkField.id})` : 'NOT FOUND'}`);

  // 6. Find all epic-related fields
  console.log('\n6. EPIC-RELATED FIELDS:');
  const epicFields = fields.filter(f =>
    f.name.toLowerCase().includes('epic') ||
    f.name.toLowerCase().includes('parent') ||
    f.id.includes('parent')
  );
  epicFields.forEach(f => console.log(`   - ${f.id}: ${f.name}`));
}

main().catch(console.error);
