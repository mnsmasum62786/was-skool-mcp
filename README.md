# Skool MCP (`was-skool-mcp`)

A self-contained, cross-platform Model Context Protocol (MCP) server for [Skool.com](https://www.skool.com). Exposes 12 tools allowing AI coding assistants (Claude Desktop, Cursor, Antigravity, VS Code, Zed, etc.) to manage communities, read/create discussion posts, reply with comments, approve/reject members, access courses and lessons, and execute arbitrary authenticated HTTP requests directly to Skool. Built by Web Analytics Solution.

## Prerequisites

| | Required | How to install |
|---|---|---|
| **Node.js 18+** | running `npx` | Mac: `brew install node` · Windows: https://nodejs.org · Linux: `apt install nodejs npm` |
| **Git** | letting `npx` clone from GitHub | Mac: `brew install git` (or first `git --version` triggers Xcode tools) · Windows: https://git-scm.com · Linux: `apt install git` |
| **Skool Account** | to access community data | [Skool.com](https://www.skool.com/) |
| **Session Cookie (`auth_token`)** | for authentication | Walked through below |

## Quick Start — 3 Steps

### Step 1 — Get Your Skool Session Cookie

Because Skool does not provide a public developer portal with API keys, this MCP uses your authenticated session token:

1. Open [https://www.skool.com](https://www.skool.com) in Chrome, Brave, Edge, or Safari and log in.
2. Open Developer Tools (`F12` on Windows/Linux or `Cmd + Option + I` on Mac).
3. Navigate to **Application** (or **Storage**) > **Cookies** > `https://www.skool.com`.
4. Locate the cookie named **`auth_token`** and copy its value (a long JWT string).

### Step 2 — Connect

Run the interactive setup command in your terminal:

```bash
npx -y github:mnsmasum62786/was-skool-mcp auth
```

1. Paste your `auth_token` when prompted.
2. *(Optional)* Enter your default community slug (e.g. `ai-community-1234` from `skool.com/ai-community-1234`).
3. The CLI will verify the connection directly with Skool and save credentials locally at `~/.was-skool-mcp/config.json` with strict `0600` permissions.

### Step 3 — Add to Your AI Client

Add the following configuration to your AI client's MCP configuration JSON file:

```json
{
  "mcpServers": {
    "Skool MCP": {
      "command": "npx",
      "args": ["-y", "github:mnsmasum62786/was-skool-mcp"]
    }
  }
}
```

#### Configuration File Locations by Client:
- **Claude Desktop (Mac)**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop (Windows)**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Cursor**: `~/.cursor/mcp.json` (or via Cursor Settings -> MCP)
- **Google Antigravity / Windsurf**: `~/.gemini/antigravity/mcp.json` or `~/.codeium/windsurf/mcp_config.json`

## What You Can Ask the AI

### Community & Members
- *"Show me the stats, rules, and description of my Skool community."*
- *"List all pending join requests and tell me why they want to join."*
- *"Approve member request `usr_123`."*
- *"List top active members in the community."*

### Discussions & Posts
- *"List the top 5 most popular posts in the community this week."*
- *"Show me post `p_98765` and summarize all the comments."*
- *"Write and publish an announcement post welcoming our new members."*
- *"Add a reply to comment `cm_123` on post `p_98765`."*

### Classroom & Courses
- *"List all courses available in the classroom."*
- *"Show me the lesson outline and video notes for lesson 3 in course `prompt-engineering-101`."*

### Universal Escape Hatch
- *"Make a GET request to `/api/v1/users/me` to check my profile details."*

## All Tools (12 Total)

| Category | Tools | Description |
|---|---|---|
| **Community** | `skool_community_info` | Get community metadata, rules, description, and member counts. |
| **Discussions** | `skool_list_posts` | List posts with pagination, sorting (`newest-cm`, `newest`, `top`), and category filters. |
| | `skool_get_post` | Retrieve full post content and nested comment thread. |
| | `skool_create_post` | Publish a new post to the community feed. |
| | `skool_add_comment` | Post a comment or reply to an existing post. |
| **Member Management** | `skool_list_members` | List members with levels, roles, and profile information. |
| | `skool_list_pending_members` | View pending member applications and screening responses. |
| | `skool_approve_member` | Approve a pending member application. |
| | `skool_reject_member` | Reject a pending member application. |
| **Classroom** | `skool_list_courses` | List all courses and curriculum sets in the community. |
| | `skool_get_lesson` | Fetch notes, resources, and video information for a lesson. |
| **Universal API** | `skool_universal_request` | Make authenticated requests to ANY Skool URL (Next.js data route or internal API). |

## CLI Commands

You can run these commands directly via `npx -y github:mnsmasum62786/was-skool-mcp <command>`:

- `auth` — Interactive prompt to connect or re-connect your Skool session.
- `status` — Show config file location, default community, and saved status.
- `logout` — Delete the locally stored credentials file (`~/.was-skool-mcp/config.json`).
- `help` — Print command line usage and environment variable options.

## Multi-Account Setup

You can bypass the local config file by setting environment variables in your client configuration. This allows managing multiple Skool communities or accounts simultaneously:

```json
{
  "mcpServers": {
    "Skool Community 1": {
      "command": "npx",
      "args": ["-y", "github:mnsmasum62786/was-skool-mcp"],
      "env": {
        "SKOOL_AUTH_TOKEN": "token_for_account_1",
        "SKOOL_DEFAULT_COMMUNITY": "community-one"
      }
    },
    "Skool Community 2": {
      "command": "npx",
      "args": ["-y", "github:mnsmasum62786/was-skool-mcp"],
      "env": {
        "SKOOL_AUTH_TOKEN": "token_for_account_2",
        "SKOOL_DEFAULT_COMMUNITY": "community-two"
      }
    }
  }
}
```

## Troubleshooting

### 1. "Skool MCP — not configured yet"
- **Cause**: The MCP server was started before configuring session cookies.
- **Fix**: Open your terminal and run `npx -y github:mnsmasum62786/was-skool-mcp auth`.

### 2. "Failed to access Skool homepage: HTTP 401 / 403"
- **Cause**: Your session cookie has expired or was copied incorrectly.
- **Fix**: Refresh Skool in your browser, copy a fresh `auth_token` value, and run `auth` again.

### 3. Windows PowerShell Execution Policy Error
If you see an error like `npx.ps1 cannot be loaded because running scripts is disabled`:
- **Fix**: Run the following command in PowerShell:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

### 4. Cache Issues after Updates
To force clear the npx cache and download the latest release:
- **Windows (PowerShell)**:
  ```powershell
  Remove-Item -Recurse -Force "$env:LOCALAPPDATA\npm-cache" -ErrorAction SilentlyContinue
  npm cache clean --force
  ```
- **Mac / Linux**:
  ```bash
  rm -rf ~/.npm/_npx
  npm cache clean --force
  ```

## License

MIT License. Built by [Web Analytics Solution](https://webanalyticsbd.com/).
