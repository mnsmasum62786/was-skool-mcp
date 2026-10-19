# Changelog

## 1.0.0 — 2026-10-19

### New Features
- Initial release of `was-skool-mcp` — shareable Model Context Protocol (MCP) server for Skool.
- Interactive authentication (`auth` command) with browser `auth_token` extraction instructions.
- Dynamic Next.js `buildId` resolution and 30-minute caching for reliable read endpoints.
- Local 0600 secure credential storage at `~/.was-skool-mcp/config.json`.
- Environment variable overrides (`SKOOL_AUTH_TOKEN`, `SKOOL_DEFAULT_COMMUNITY`, `SKOOL_BASE_URL`).
- 12 tools covering:
  - Community metadata (`skool_community_info`)
  - Discussions & Posts (`skool_list_posts`, `skool_get_post`, `skool_create_post`, `skool_add_comment`)
  - Member management & approvals (`skool_list_members`, `skool_list_pending_members`, `skool_approve_member`, `skool_reject_member`)
  - Classroom courses & lessons (`skool_list_courses`, `skool_get_lesson`)
  - Universal API Call (`skool_universal_request`)
- Full Windows, Mac, and Linux compatibility with ESM URL wrapping.
