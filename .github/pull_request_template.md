## Description
Brief summary of changes proposed in this Pull Request.

## Security Verification Checklist
- [ ] No hard-coded secrets, tokens, or credentials committed
- [ ] All database queries use parameterized prepared statements (No string concatenation)
- [ ] Strict authorization check enforced via server middleware (`requireTripRole`)
- [ ] Input validated with express-validator schemas and sanitized
- [ ] Automated Jest unit and integration tests passing locally (`npm test`)
- [ ] Security events added to audit log (`logAudit`)
