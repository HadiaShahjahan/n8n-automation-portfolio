# Configuration and Testing

The workflow exports are inactive and external-service nodes are disabled. This is intentional: importing a portfolio template must not send requests, write CRM records, or email contacts before the operator reviews it.

## Recommended n8n Setup

- Use a current n8n 2.x release.
- Import the JSON files from `workflow/`.
- Keep workflows inactive during configuration.
- Store credentials in n8n's credential manager or an approved external-secrets solution.
- Never paste a live secret directly into a workflow parameter that will be exported to Git.

## AI Sales Automation Workflow

### Webhook contract

The workflow accepts a JSON POST body with these fields:

```json
{
  "request_id": "lead-2026-0001",
  "email": "buyer@example.com",
  "first_name": "Avery",
  "last_name": "Morgan",
  "company": "Example Company",
  "company_domain": "example.com",
  "job_title": "Operations Manager",
  "company_size": "51-200",
  "message": "We need help automating inbound lead routing.",
  "consent": true
}
```

`request_id`, `email`, and `consent` are required. The sample uses reserved example data and is safe to retain in documentation.

### Environment-variable placeholders

The HTTP Request nodes reference variable names only:

| Variable | Used by |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI qualification request |
| `OPENAI_MODEL` | Optional model override |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot search, create, and update requests |
| `SLACK_BOT_TOKEN` | Slack notification and error alert requests |
| `SLACK_CHANNEL_ID` | Destination Slack channel |
| `ENRICHMENT_API_URL` | Optional company-enrichment endpoint |
| `ENRICHMENT_API_KEY` | Optional enrichment-provider token |

On n8n Cloud or deployments that restrict `$env`, replace these expressions with n8n credentials. Do not commit exported credential objects.

### HubSpot preparation

Create and test contact properties named `n8n_request_id` and `n8n_lead_score`, or update every related workflow mapping to approved property names. Confirm that the intended portal permits contact search, create, and update operations. Review standard property names such as `firstname`, `lastname`, `company`, and `jobtitle` against the portal schema.

### Google Sheets preparation

Create sheets named `Leads` and `Workflow Errors`, or change the node mappings. Replace `YOUR_GOOGLE_SHEET_ID` with the actual document selector inside n8n. Use OAuth credentials stored by n8n; do not add an OAuth client secret to the export.

### Gmail and Slack preparation

- Select an n8n Gmail OAuth credential on each Gmail node.
- Review subjects and message text before enabling email.
- Set a real Slack channel through credentials or the documented channel variable.
- Confirm that alerts contain only approved fields.

### Optional enrichment

The enrichment node is a provider-neutral placeholder and remains disabled. Replace its URL and response mapping with the selected vendor's documented API. Send the minimum necessary company fields and review the vendor's privacy and retention terms.

## Test Matrix

Run tests with invented data only.

| Test | Expected result |
| --- | --- |
| Missing `email` | HTTP 422; no provider node runs |
| Invalid email format | HTTP 422; no CRM or email action |
| Missing `request_id` | HTTP 422 |
| Valid lead, providers disabled | Accepted response using fallback qualification |
| Repeated `request_id` | Existing HubSpot contact is updated after configuration |
| New request ID, existing normalized email | Email fallback finds and updates the contact |
| COLD lead | No initial or delayed marketing email |
| HOT/WARM lead without consent | No marketing email |
| AI response is invalid JSON | Rules-based fallback is labeled as fallback |
| Workflow execution failure | Error handler outputs only redacted fields |

## Before Activation

1. Add webhook authentication or verify an upstream signature.
2. Set provider request timeouts and a retry policy.
3. Use a durable idempotency mechanism for production traffic.
4. Define data retention for executions and logs.
5. Connect the Workflow Error Alert Handler in workflow settings.
6. Confirm consent and email rules with the business owner.
7. Run end-to-end tests in a sandbox CRM and test inbox.
8. Review n8n execution data for accidental sensitive fields before activation.
