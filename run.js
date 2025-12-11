#!/usr/bin/env node
/**
 * Cross-Platform Jira Script Runner
 *
 * Runs scripts from skill folders. Each skill contains its own scripts/ directory.
 * Loads environment variables from .env file in this directory.
 *
 * Usage:
 *   node run.js test              # Runs jira-auth/scripts/test
 *   node run.js workflow-demo     # Runs jira-transitions/scripts/workflow-demo
 *   node run.js --python test     # Force Python version
 *   node run.js --node test       # Force Node.js version
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const JIRA_DIR = __dirname;

/**
 * Load environment variables from .env file
 */
function loadEnv() {
  const envPath = path.join(JIRA_DIR, '.env');

  if (!fs.existsSync(envPath)) {
    console.error('Warning: No .env file found at', envPath);
    console.error('Create .env with JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL, JIRA_PROJECT_KEY');
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      envVars[key] = value;
      process.env[key] = value;
    }
  }

  return envVars;
}

// Load environment variables immediately
const jiraEnv = loadEnv();

// Script mappings: command -> { skill, script }
const SCRIPTS = {
  'test':            { skill: 'jira-auth',        script: 'test' },
  'check-fields':    { skill: 'jira-projects',    script: 'check-fields' },
  'check-issues':    { skill: 'jira-search',      script: 'check-issues' },
  'create-one':      { skill: 'jira-issues',      script: 'create-one' },
  'delete-all':      { skill: 'jira-issues',      script: 'delete-all' },
  'workflow':        { skill: 'jira-transitions', script: 'workflow-demo' },
  'workflow-demo':   { skill: 'jira-transitions', script: 'workflow-demo' },
  'bulk-create':     { skill: 'jira-agile',       script: 'bulk-create' },
  'add-subtasks':    { skill: 'jira-safe',        script: 'add-subtasks' },
  'create-two-level':{ skill: 'jira-safe',        script: 'create-two-level' },
  'create-mvp':      { skill: 'jira-safe',        script: 'create-mvp' },
  // Confluence Spaces
  'list-spaces':     { skill: 'jira-spaces',      script: 'list-spaces' },
  'create-space':    { skill: 'jira-spaces',      script: 'create-space' },
  'delete-space':    { skill: 'jira-spaces',      script: 'delete-space' }
};

function checkNodeAvailable() {
  try {
    execSync('node --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkPythonAvailable() {
  try {
    execSync('python --version', { stdio: 'ignore' });
    return true;
  } catch {
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

function getPythonCommand() {
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    return 'python3';
  } catch {
    return 'python';
  }
}

function getScriptPath(skill, script, ext) {
  return path.join(JIRA_DIR, skill, 'scripts', `${script}${ext}`);
}

function runScript(scriptName, args, forceRuntime) {
  const mapping = SCRIPTS[scriptName];

  if (!mapping) {
    console.error(`Error: Unknown script '${scriptName}'`);
    console.error('Run "node run.js --help" for available scripts');
    process.exit(1);
  }

  const { skill, script } = mapping;
  const mjsPath = getScriptPath(skill, script, '.mjs');
  const pyPath = getScriptPath(skill, script, '.py');

  const hasMjs = fs.existsSync(mjsPath);
  const hasPy = fs.existsSync(pyPath);

  if (!hasMjs && !hasPy) {
    console.error(`Error: No script found for '${scriptName}'`);
    console.error(`Looked for: ${mjsPath} or ${pyPath}`);
    process.exit(1);
  }

  let runtime, scriptPath;

  if (forceRuntime === 'node') {
    if (!hasMjs) {
      console.error(`Error: No Node.js version available for '${scriptName}'`);
      process.exit(1);
    }
    runtime = 'node';
    scriptPath = mjsPath;
  } else if (forceRuntime === 'python') {
    if (!hasPy) {
      console.error(`Error: No Python version available for '${scriptName}'`);
      process.exit(1);
    }
    runtime = 'python';
    scriptPath = pyPath;
  } else {
    // Auto-detect: prefer Python on Windows (better encoding), Node.js elsewhere
    const isWindows = process.platform === 'win32';

    if (isWindows && hasPy && checkPythonAvailable()) {
      runtime = 'python';
      scriptPath = pyPath;
    } else if (hasMjs && checkNodeAvailable()) {
      runtime = 'node';
      scriptPath = mjsPath;
    } else if (hasPy && checkPythonAvailable()) {
      runtime = 'python';
      scriptPath = pyPath;
    } else {
      console.error('Error: No suitable runtime found (Node.js or Python)');
      process.exit(1);
    }
  }

  const command = runtime === 'python' ? getPythonCommand() : 'node';

  console.log(`Running: ${command} ${scriptPath} ${args.join(' ')}`);
  console.log('');

  const child = spawn(command, [scriptPath, ...args], {
    stdio: 'inherit',
    cwd: JIRA_DIR
  });

  child.on('close', (code) => {
    process.exit(code);
  });
}

function showHelp() {
  console.log(`
Jira Script Runner

Usage:
  node run.js <script> [args...]
  node run.js --python <script> [args...]
  node run.js --node <script> [args...]

Scripts:
  test             Test authentication (jira-auth)
  check-fields     List project fields (jira-projects)
  check-issues     List issues in project (jira-search)
  create-one       Create a single issue (jira-issues)
  delete-all       Delete all issues (jira-issues)
  workflow-demo    Demonstrate transitions (jira-transitions)
  bulk-create      Create from git commits (jira-agile)
  add-subtasks     Add subtasks to issue (jira-safe)
  create-two-level Create Epic/Story/Subtask (jira-safe)
  create-mvp       Create full MVP backlog (jira-safe)

Confluence Spaces:
  list-spaces      List Confluence spaces (jira-spaces)
  create-space     Create a Confluence space (jira-spaces)
  delete-space     Delete a Confluence space (jira-spaces)

Options:
  --python        Force Python version
  --node          Force Node.js version
  --help, -h      Show this help

Examples:
  node run.js test
  node run.js add-subtasks demo
  node run.js workflow-demo demo SCRUM-100
  node run.js --python test
`);
}

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

let forceRuntime = null;
let scriptArgs = [...args];

if (args[0] === '--python') {
  forceRuntime = 'python';
  scriptArgs = args.slice(1);
} else if (args[0] === '--node') {
  forceRuntime = 'node';
  scriptArgs = args.slice(1);
}

if (scriptArgs.length === 0) {
  console.error('Error: No script specified');
  showHelp();
  process.exit(1);
}

const scriptName = scriptArgs[0];
const extraArgs = scriptArgs.slice(1);

runScript(scriptName, extraArgs, forceRuntime);
