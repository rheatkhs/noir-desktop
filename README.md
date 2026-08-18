# Noir Desktop (Grace Field House Edition)

Noir Desktop is a standalone desktop AI-agent workbench built on Tauri v2 and React 19. It provides an intuitive graphical interface for operating autonomous LLM-powered agents that can interact directly with your workspace—reading/writing files and executing bash commands—under real-time telemetry and rigorous user-approved safety gates.

## 🌌 Product Vision & Grace Field House Theme

The interface utilizes a tactical, dark-tech aesthetic themed around **Grace Field House** to reinforce mental models for power-user security:

*   **Agent Identification (Identity Registry):** Worker instances are assigned tactical names upon session creation (e.g., `NORMAN-22194`, `RAY-81194`, `EMMA-63194`).
*   **Mama's Gate (Approval Guard):** Destructive actions (like `rm`, shell redirect overwrites, or files modification) trigger a modal requesting user approval. Safe commands (like `git diff`, `ls`, or reading files) bypass this check.
*   **Escape Plan Mode (Autonomous Workspace):** Bypasses all prompt checks to allow automated coding agents to run unsupervised in isolated workspaces.
*   **Intelligence Score (Metrics & Analytics):** Displays session token usage, average tool latency, estimated cost, and tool call success rates loaded dynamically from SQLite.

---

## 🛠️ Technical Stack

*   **Runtime/Package Manager:** Bun
*   **Frameworks:** Tauri v2 · React 19 · TypeScript 7
*   **Styles:** Tailwind CSS v4 · lucide-react
*   **Database:** SQLite (embedded via `tauri-plugin-sql`)
*   **Credentials Store:** OS Keychain (via `tauri-plugin-store`)
*   **Markdown Rendering:** react-markdown · remark-gfm
*   **Diff Editing:** Monaco Editor (via `@monaco-editor/react`)

---

## 🚀 Getting Started

### Prerequisites

*   **Rust & Cargo:** Installed (Rust version `1.77.2+` / Cargo `1.97.0+`)
*   **Bun Runtime:** Installed (`1.3+`)
*   **C++ Build Tools:** Needed for Tauri on Windows/macOS/Linux.

### Installation

Clone the repository and install the frontend dependencies:

```bash
# Clone the repository
git clone https://github.com/rheatkhs/noir-desktop.git
cd noir-desktop

# Install packages
bun install
```

### Running Development Server

To boot both Vite HMR dev server and compile the Tauri Rust desktop window:

```bash
bun tauri dev
```

*Note: The first compilation compiles ~490 Rust dependencies. Subsequent compilations take under 3 seconds.*

### Building Production Installers

To package standalone installers (`.exe`/`.msi` on Windows, `.dmg` on macOS, `.AppImage`/`.deb` on Linux):

```bash
bun tauri build
```

---

## 🏗️ Architecture

```
                 +--------------------------------------------------------+
                 | FRONTEND: React 19 + Tailwind v4 + TypeScript          |
                 | - HudBar (Status indicators & token count display)     |
                 | - Sidebar (Search, Session list CRUD, settings)        |
                 | - ChatPanel (Streaming, Markdown, Tool Accordeons)    |
                 | - Monaco Diff View & Mama's Gate Modal                 |
                 +---------------------------^----------------------------+
                                             |
                                    Tauri IPC Events
                                             |
                 +---------------------------v----------------------------+
                 | TAURI BACKEND: Rust Core                               |
                 | - Orchestrator (Tool calling loop & event bridge)       |
                 | - Commands (Native execute_bash, fs read/write/list)   |
                 | - Classifier (ActionClass categorizer)                 |
                 | - SQLite Database (Session storage & metrics logging)  |
                 | - OS Secure Storage (Store API keys)                   |
                 +---------------------------^----------------------------+
                                             |
                                     Direct SSE Stream
                                             |
                 +---------------------------v----------------------------+
                 | LLM PROVIDERS:                                         |
                 | - Anthropic Messages API (Anthropic provider)          |
                 | - OpenAI API compat. (OpenAI / OpenRouter / Ollama)     |
                 +--------------------------------------------------------+
```

---

## 📂 Project Structure

```
noir-desktop/
├── .github/workflows/       # CI/CD Workflows
│   └── release.yml          # GitHub Actions multi-platform compiler
├── src-tauri/               # Rust Tauri Core
│   ├── capabilities/        # Desktop capabilities & system permissions
│   ├── src/
│   │   ├── providers/       # LLM SSE stream clients (OpenAI, Anthropic)
│   │   ├── classifier.rs    # Safe vs Destructive command regex detector
│   │   ├── commands.rs      # Native OS bash & sandboxed filesystem execution
│   │   ├── identity.rs      # Tag generator using XOR-fold nanos time
│   │   ├── orchestrator.rs  # Tool loops, events, and approval guards
│   │   ├── schema.rs        # SQLite DB table schema migrations
│   │   ├── streaming.rs     # Stream invoke handlers
│   │   └── lib.rs           # Tauri configuration builder & plugins init
│   └── tauri.conf.json      # Tauri settings & app details
├── src/                     # React Frontend
│   ├── components/
│   │   ├── approval/        # Mama's Gate Modal
│   │   ├── chat/            # Message bubbles & ToolCallAccordions
│   │   ├── dashboard/       # Intelligence Score metrics dashboard
│   │   ├── diff/            # Monaco split DiffViewer
│   │   ├── layout/          # HUD Bar, Sidebar, AppLayout
│   │   └── settings/        # API key & Escape Plan configuration
│   ├── hooks/
│   │   ├── useApproval.ts   # Tauri-event approval listener
│   │   ├── useChat.ts       # Event bridge streaming listener
│   │   ├── useSessions.ts   # SQLite CRUD session loader
│   │   └── useSettings.ts   # Persistent JSON settings store
│   ├── lib/                 # Core utilities
│   ├── types/               # Strict TypeScript interface contracts
│   ├── App.tsx              # Main orchestrator router
│   ├── app.css              # CSS Imports (Tailwind CSS v4)
│   └── main.tsx             # React DOM Bootstrapper
├── package.json             # Bun dependencies and scripts
└── prd.md                   # Product Requirements Document
```

---

## 🚀 CI/CD & Releases

Noir Desktop uses GitHub Actions (`release.yml`) to automatically compile releases for all target OS platforms on pushes matching tag `v*` (e.g. `v2.0.0`). 

The pipeline:
1. Provisions standard Windows, Ubuntu, and macOS runners.
2. Caches Rust targets & builds native libraries (like WebKit2GTK on Linux).
3. Installs frontend components and builds assets with Bun.
4. Invokes Tauri bundler to sign, package, and upload releases directly as GitHub drafts.

---

*Developed and maintained by the Noir Desktop engineering team.*
