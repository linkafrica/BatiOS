# Production Release Evidence

Copy this template for every production release. Store completed records in the
release notes, an issue comment, or another approved audit location. Do not add
secret values, credentials, tokens, or customer data.

## Release Identity

| Field           | Value |
| --------------- | ----- |
| Release date    |       |
| Release owner   |       |
| Incident owner  |       |
| Main commit SHA |       |
| Pull requests   |       |
| Issues closed   |       |
| Fly apps        |       |

## Build And Review Gates

| Gate              | Result | Evidence link or note |
| ----------------- | ------ | --------------------- |
| `qa`              |        |                       |
| `qa-agent`        |        |                       |
| Required review   |        |                       |
| Branch protection |        |                       |
| Secrets scan      |        |                       |
| Release checklist |        |                       |

## Database Backup And Restore Evidence

| Field                         | Value |
| ----------------------------- | ----- |
| Database provider             |       |
| Production database app/name  |       |
| Backups enabled               |       |
| Latest backup timestamp       |       |
| Restore rehearsal target      |       |
| Restore rehearsal timestamp   |       |
| Restore verification operator |       |
| Restore verification result   |       |

## Deployment Evidence

| Surface      | App name | Image or release id | Deploy result | URL |
| ------------ | -------- | ------------------- | ------------- | --- |
| Field PWA    |          |                     |               |     |
| Admin        |          |                     |               |     |
| PM dashboard |          |                     |               |     |
| QS dashboard |          |                     |               |     |

## Smoke And Monitoring

| Check                    | Result | Evidence link or note |
| ------------------------ | ------ | --------------------- |
| Staging smoke            |        |                       |
| Production smoke         |        |                       |
| Domain/TLS verification  |        |                       |
| App health alerts        |        |                       |
| Database backup alerts   |        |                       |
| Database connection logs |        |                       |

## Rollback Plan

| Field                      | Value |
| -------------------------- | ----- |
| Rollback owner             |       |
| Previous good app releases |       |
| Database rollback required |       |
| Backup restore target      |       |
| Rollback smoke command     |       |
| Communications owner       |       |

## Go/No-Go

| Signoff             | Name | Decision | Timestamp |
| ------------------- | ---- | -------- | --------- |
| Release owner       |      |          |           |
| Platform owner      |      |          |           |
| Operations owner    |      |          |           |
| Compliance reviewer |      |          |           |

## Notes

- Decisions:
- Exceptions:
- Follow-up issues:
