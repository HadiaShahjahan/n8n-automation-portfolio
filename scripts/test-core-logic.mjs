import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const loadWorkflow = async (filename) => JSON.parse(
  await readFile(path.join(process.cwd(), 'workflow', filename), 'utf8'),
);

const codeFrom = (workflow, nodeName) => {
  const node = workflow.nodes.find((candidate) => candidate.name === nodeName);
  assert(node, `Missing Code node: ${nodeName}`);
  return node.parameters.jsCode;
};

const runCode = (source, json, lookup = () => undefined) => {
  const execute = new Function('$json', '$', source);
  return execute(json, lookup);
};

const sales = await loadWorkflow('ai-sales-automation.json');
const normalizeSource = codeFrom(sales, 'Normalize and Validate');

const invalid = runCode(normalizeSource, {
  body: { request_id: '', email: 'not-an-email' },
})[0].json;
assert.equal(invalid.valid, false);
assert.deepEqual(
  invalid.validation_errors.map((error) => error.field).sort(),
  ['consent', 'email', 'request_id'],
);

const normalized = runCode(normalizeSource, {
  body: {
    request_id: '  lead-001  ',
    email: '  Buyer@Example.COM ',
    first_name: '  Avery ',
    company_domain: 'https://Example.com/about',
    consent: 'yes',
  },
})[0].json;
assert.equal(normalized.valid, true);
assert.equal(normalized.lead.request_id, 'lead-001');
assert.equal(normalized.lead.email, 'buyer@example.com');
assert.equal(normalized.lead.company_domain, 'example.com');
assert.equal(normalized.lead.consent, true);

const parseSource = codeFrom(sales, 'Parse AI Qualification');
const nodeData = {
  'Normalize and Validate': normalized,
};
const lookup = (name) => ({ first: () => ({ json: nodeData[name] }) });
const fallback = runCode(parseSource, {}, lookup)[0].json;
assert.equal(fallback.qualification_source, 'rules_fallback');
assert(Number.isInteger(fallback.score));
assert(fallback.score >= 0 && fallback.score <= 100);

const aiResult = runCode(parseSource, {
  choices: [{ message: { content: '{"score":87,"reason":"Strong fit and clear intent"}' } }],
}, lookup)[0].json;
assert.equal(aiResult.qualification_source, 'openai');
assert.equal(aiResult.score, 87);

const errorWorkflow = await loadWorkflow('workflow-error-alert-handler.json');
const redactSource = codeFrom(errorWorkflow, 'Redact Error Data');
const redacted = runCode(redactSource, {
  workflow: { name: 'Example workflow' },
  execution: {
    id: 'execution-1',
    lastNodeExecuted: 'Provider Request',
    error: { message: 'token=live-token password:secret Bearer abc.def.ghi' },
  },
})[0].json;
assert(!redacted.message.includes('live-token'));
assert(!redacted.message.includes('secret'));
assert(!redacted.message.includes('abc.def.ghi'));
assert.equal(redacted.workflow_name, 'Example workflow');

console.log('Core logic tests passed: validation, normalization, AI fallback, AI parsing, and error redaction.');
