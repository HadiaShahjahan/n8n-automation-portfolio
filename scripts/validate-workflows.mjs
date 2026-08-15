import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const workflowDirectory = path.join(root, 'workflow');
const filenames = (await readdir(workflowDirectory))
  .filter((name) => name.endsWith('.json'))
  .sort();

const externalNodeTypes = new Set([
  'n8n-nodes-base.gmail',
  'n8n-nodes-base.googleSheets',
  'n8n-nodes-base.httpRequest',
]);

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

const problems = [];

for (const filename of filenames) {
  const fullPath = path.join(workflowDirectory, filename);
  const raw = await readFile(fullPath, 'utf8');
  let workflow;

  try {
    workflow = JSON.parse(raw);
  } catch (error) {
    problems.push(`${filename}: invalid JSON (${error.message})`);
    continue;
  }

  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    problems.push(`${filename}: nodes must be a non-empty array`);
    continue;
  }

  if (workflow.active !== false) {
    problems.push(`${filename}: workflow must be inactive in the repository`);
  }

  const names = workflow.nodes.map((node) => node.name);
  const ids = workflow.nodes.map((node) => node.id);
  const nameSet = new Set(names);
  const idSet = new Set(ids);

  if (nameSet.size !== names.length) problems.push(`${filename}: duplicate node name`);
  if (idSet.size !== ids.length) problems.push(`${filename}: duplicate node ID`);

  for (const node of workflow.nodes) {
    if (!node.id || !node.name || !node.type) {
      problems.push(`${filename}: every node needs an ID, name, and type`);
    }

    if (externalNodeTypes.has(node.type) && node.disabled !== true) {
      problems.push(`${filename}: external node must be disabled (${node.name})`);
    }

    if (Object.hasOwn(node, 'credentials')) {
      problems.push(`${filename}: credential reference found (${node.name})`);
    }

    if (node.type === 'n8n-nodes-base.code') {
      const source = node.parameters?.jsCode;
      try {
        // Compile only. n8n globals are provided as parameters and no code executes.
        new Function('$json', '$env', '$', '$now', source);
      } catch (error) {
        problems.push(`${filename}: invalid JavaScript in ${node.name} (${error.message})`);
      }
    }
  }

  for (const [source, outputs] of Object.entries(workflow.connections ?? {})) {
    if (!nameSet.has(source)) {
      problems.push(`${filename}: unknown connection source (${source})`);
    }

    for (const branch of outputs.main ?? []) {
      for (const edge of branch ?? []) {
        if (!nameSet.has(edge.node)) {
          problems.push(`${filename}: unknown connection target (${edge.node})`);
        }
      }
    }
  }

  if (workflow.name === 'Portfolio - AI Sales Automation Workflow') {
    const falseBranch = workflow.connections?.['Valid Lead?']?.main?.[1] ?? [];
    const queue = falseBranch.map((edge) => edge.node);
    const reachable = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (reachable.has(current)) continue;
      reachable.add(current);
      const downstream = workflow.connections?.[current]?.main ?? [];
      for (const branch of downstream) {
        for (const edge of branch ?? []) queue.push(edge.node);
      }
    }

    for (const node of workflow.nodes.filter((candidate) => reachable.has(candidate.name))) {
      if (externalNodeTypes.has(node.type)) {
        problems.push(`${filename}: invalid branch can reach external node (${node.name})`);
      }
    }

    if (!reachable.has('Respond Safe 422')) {
      problems.push(`${filename}: invalid branch does not reach Respond Safe 422`);
    }
  }

  for (const pattern of secretPatterns) {
    if (pattern.test(raw)) problems.push(`${filename}: possible secret matched ${pattern}`);
  }

  console.log(`OK ${filename}: ${workflow.nodes.length} nodes`);
}

if (filenames.length === 0) problems.push('No workflow JSON files found');

if (problems.length > 0) {
  console.error('\nValidation failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`\nValidated ${filenames.length} inactive, credential-free workflow exports.`);
}
