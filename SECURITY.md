# Security Policy

## Repository Content

This repository must remain free of credentials and client data. Before publishing an export, verify that it contains no:

- API keys, bearer tokens, passwords, or webhook secrets
- OAuth client secrets, refresh tokens, or credential objects
- Personal or client email addresses
- Private webhook, CRM, spreadsheet, or document URLs
- Account, portal, sheet, channel, or workflow identifiers
- Pinned production payloads or execution data
- Raw provider errors or stack traces containing sensitive context

Use clearly named placeholders and n8n credentials instead of embedded secrets.

## Deployment Checklist

- Authenticate public webhooks and validate signatures where available.
- Reject invalid requests before enrichment, CRM writes, or email.
- Minimize fields sent to AI and enrichment providers.
- Restrict provider credentials to the permissions needed by the workflow.
- Define execution-data retention and redact sensitive logs.
- Add durable idempotency, timeouts, retry limits, and monitoring for production use.
- Test using sandbox accounts and invented data.

## Reporting a Problem

Do not open a public issue containing a live secret or customer payload. Revoke the exposed secret first, remove sensitive data from Git history if necessary, and report only a redacted description.
