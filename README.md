# Git-Auto 🚀

`git-auto` is a lightweight CLI tool that automates the process of staging changes and generating professional, AI-powered commit messages. No more guessing what to write in your commit messages—let AI handle it!

## ✨ Features

- **One-Command Workflow**: Stages all changes and commits them in one go.
- **AI-Powered Messages**: Analyzes your `git diff` to generate a meaningful commit message.
- **Conventional Commits**: Follows the [Conventional Commits](https://www.conventionalcommits.org/) specification (e.g., `feat:`, `fix:`, `chore:`).
- **Customizable**: Override AI messages with your own or preview them before committing.

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
To use the `git-auto` command anywhere on your system:
```bash
npm install -g @himamshus06/git-auto
```

## ⚙️ Configuration

The tool uses the Groq API for fast, free AI generation.

1. Get a free API key from [Groq Cloud](https://console.groq.com/).
2. Create a `.env` file in the root directory:
   ```env
   GROQ_API_KEY=your_api_key_here
   ```

## 🚀 Usage

### Basic Commit
Stages all changes and commits with an AI-generated message:
```bash
git-auto commit
```

### Commit with Custom Message
Override the AI and provide your own message:
```bash
git-auto commit -m "feat: add amazing new feature"
```

### Preview Message (Dry Run)
See what the AI would generate without actually committing:
```bash
git-auto commit --dry-run
```

## 🛠️ How it Works

1. **Staging**: Runs `git add .` to stage all changes.
2. **Diffing**: Extracts the staged changes using `git diff --cached`.
3. **AI Generation**: Sends the diff to a Large Language Model (LLM) via Groq.
4. **Committing**: Executes `git commit -m "generated_message"`.

## 📜 License
MIT
