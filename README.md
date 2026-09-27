# Git-Auto 🚀

`git-auto` is a lightweight CLI tool that automates the process of staging changes, generating professional AI-powered commit messages, and creating directory structures from pasted trees. No more guessing what to write in your commit messages or manually creating nested folders—let AI handle it!

## ✨ Features


- **One-Command Workflow**: Stages all changes and commits them in one go.
- **AI-Powered Messages**: Analyzes your `git diff` to generate a meaningful commit message.
- **Conventional Commits**: Follows the [Conventional Commits](https://www.conventionalcommits.org/) specification (e.g., `feat:`, `fix:`, `chore:`).
- **Smart Diff Handling**: Uses a Map-Reduce approach to summarize large changes, ensuring no detail is lost regardless of diff size.
- **Interactive Experience**: Preview and edit AI-generated messages before they are committed to your history.
- **Tree Generation**: Instantly create complex directory structures by pasting a visual tree.
- **Security Guard**: Scan your project for leaked secrets and API keys, generate security reports, and automatically update `.gitignore` to protect sensitive files.

## 📦 Installation


### 1. Clone the Repository
```bash
git clone https://github.com/your-username/git-auto.git
cd git-auto
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Install Globally
To use the `git auto` command anywhere on your system:
```bash
npm install -g @himamshus06/git-auto
```

To make it work as a git alias (`git ac commit` or `git ac tree` instead of `git-auto commit`), run:
```bash
git config --global alias.ac "!git-auto"
```

## ⚙️ Configuration

`git-auto` is provider-agnostic and supports multiple AI backends, including local LLMs.

1. Create a `.env` file in the root directory.
2. Choose your preferred provider configuration:

### Option A: Groq (Default - Fast & Free)
Get a free API key from [Groq Cloud](https://console.groq.com/).
```env
AI_PROVIDER=groq
AI_API_KEY=your_groq_api_key_here
```

### Option B: OpenAI
```env
AI_PROVIDER=openai
AI_API_KEY=your_openai_api_key_here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o
```

### Option C: Local LLMs (via Ollama)
Install [Ollama](https://ollama.com/) and run a model (e.g., `ollama run llama3`).
```env
AI_PROVIDER=ollama
AI_MODEL=llama3
AI_BASE_URL=http://localhost:11434/v1
```

### Advanced Configuration
| Variable | Description | Default |
| :--- | :--- | :--- |
| `AI_PROVIDER` | The AI backend to use (`groq`, `openai`, `ollama`, `local`) | `groq` |
| `AI_API_KEY` | API key for cloud providers | (Required for cloud) |
| `AI_BASE_URL` | API endpoint URL | `https://api.groq.com/openai/v1` |
| `AI_MODEL` | The specific model ID to use | `qwen/qwen3.8-27b` |

## 🚀 Usage

### Basic Commit
Stages all changes and commits with an AI-generated message:
```bash
git-auto commit
```

### Create Directory Tree
Create a directory structure by pasting a visual tree:
```bash
git-auto tree
```

### Security Scan
Scan for hardcoded secrets and protect your environment:
```bash
git-auto secure
```

### Commit with Custom Message
Override the AI and provide your own message:
```bash
git auto commit -m "feat: add amazing new feature"
```

### Preview Message (Dry Run)
See what the AI would generate without actually committing:
```bash
git auto commit --dry-run
```

## 🛠️ How it Works

1. **Staging**: Runs `git add .` to stage all changes.
2. **Diffing**: Extracts the staged changes using `git diff --cached`.
3. **AI Generation**: 
    - **Map Phase**: For large diffs, it splits the changes into manageable chunks and generates a concise summary for each.
    - **Reduce Phase**: It then aggregates these summaries into a single, professional commit message following Conventional Commits.
4. **Interactive Review**: Presents the generated message for your approval or modification.
5. **Committing**: Executes `git commit -m "final_message"`.

## 📜 License
MIT
