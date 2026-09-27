const fs = require('fs').promises;
const path = require('path');
const ignore = require('ignore');
const pLimit = require('p-limit');
const ai = require('../ai');

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB limit
const MAX_CONCURRENT_AI_REQUESTS = 4; // Max parallel AI calls
const SENSITIVE_FILENAME_PATTERNS = [/^\.env(\..+)?$/i, /id_rsa/i, /credentials\.json$/i];

const SECRET_PATTERNS = {
    'AWS Access Key': /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    'AWS Secret Key': /aws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9\/+]{40}['"]?/i,
    'GitHub Token': /(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,
    'Stripe API Key': /sk_(live|test)_[0-9a-zA-Z]{24}/,
    'Private Key': /-----BEGIN (?:RSA|OPENSSH|EC|PGP|DSA)? PRIVATE KEY-----/,
    'Generic API Key': /(api[_-]?key|secret|token|auth|password)\s*[:=]\s*['"]?[A-Za-z0-9\-_]{16,128}['"]?/i,
};

function calculateEntropy(str) {
    const len = str.length;
    const freq = {};
    for (let char of str) freq[char] = (freq[char] || 0) + 1;
    return Object.values(freq).reduce((sum, count) => {
        const p = count / len;
        return sum - p * Math.log2(p);
    }, 0);
}

async function getGitignoreInstance(rootDir) {
    const ig = ignore();
    // Default system ignores
    ig.add(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);

    try {
        const gitignorePath = path.join(rootDir, '.gitignore');
        const content = await fs.readFile(gitignorePath, 'utf8');
        ig.add(content);
    } catch (e) {
        // .gitignore doesn't exist yet; proceed with defaults
    }
    return ig;
}

async function scanProject(dir = process.cwd()) {
    const issues = [];
    const sensitiveFiles = new Set();
    const provider = ai.getAIProvider();
    const limit = pLimit(MAX_CONCURRENT_AI_REQUESTS);
    const ig = await getGitignoreInstance(dir);

    const verificationQueue = [];

    async function walk(currentDir) {
        const files = await fs.readdir(currentDir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(currentDir, file.name);
            const relativePath = path.relative(dir, fullPath);

            // Skip files/directories listed in .gitignore
            if (relativePath && ig.ignores(relativePath)) {
                continue;
            }

            if (file.isDirectory()) {
                await walk(fullPath);
            } else if (file.isFile()) {
                if (file.name === 'security-report.md' || file.name === 'package-lock.json') continue;

                // 1. Direct filename checks
                if (SENSITIVE_FILENAME_PATTERNS.some(p => p.test(file.name))) {
                    issues.push({ file: fullPath, type: 'Sensitive File Exposed', confidence: 'High' });
                    sensitiveFiles.add(fullPath);
                    continue;
                }

                // 2. Prevent scanning large binaries or huge build artifacts
                const stats = await fs.stat(fullPath);
                if (stats.size > MAX_FILE_SIZE_BYTES) continue;

                const content = await fs.readFile(fullPath, 'utf8');

                for (const [type, regex] of Object.entries(SECRET_PATTERNS)) {
                    const match = content.match(regex);
                    if (match) {
                        const matchedValue = match[0];

                        // 3. Entropy pre-filter to drop low-randomness placeholders
                        if (type.includes('Key') || type.includes('Token')) {
                            if (calculateEntropy(matchedValue) < 3.0) continue;
                        }

                        // Queue for AI verification
                        verificationQueue.push({
                            fullPath,
                            type,
                            content,
                            match
                        });

                        break; // Stop matching other regexes for this file instance
                    }
                }
            }
        }
    }

    await walk(dir);

    // Run AI verification tasks with controlled concurrency
    const verificationTasks = verificationQueue.map(item =>
        limit(async () => {
            const isReal = await verifyWithAI(provider, item.content, item.match, item.type);
            if (isReal) {
                issues.push({ file: item.fullPath, type: item.type, confidence: 'High' });
                sensitiveFiles.add(item.fullPath);
            }
        })
    );

    await Promise.all(verificationTasks);

    return {
        issues,
        sensitiveFiles: Array.from(sensitiveFiles)
    };
}

async function verifyWithAI(provider, content, match, type) {
    const index = match.index;
    const rawValue = match[0];

    // Redact secret value before network transfer
    const maskedValue = rawValue.length > 8 
        ? rawValue.substring(0, 3) + '...' + rawValue.substring(rawValue.length - 3)
        : '[REDACTED]';

    const rawSnippet = content.substring(Math.max(0, index - 50), Math.min(content.length, index + 100));
    const safeSnippet = rawSnippet.replace(rawValue, maskedValue);

    const prompt = `
Analyze the code snippet below. Determine if context around "${type}" indicates a real secret or a fake/placeholder/example value.
Note: The secret itself has been masked as "${maskedValue}".

Snippet:
---
${safeSnippet}
---

Is this likely a real secret or a placeholder/test variable? Respond ONLY with "REAL" or "PLACEHOLDER".`;

    try {
        const response = await provider.generate(prompt);
        return response.toUpperCase().includes('REAL');
    } catch (e) {
        return true; // Safe fallback on API error/timeout
    }
}

async function updateGitignore(sensitiveFiles, rootDir = process.cwd()) {
    if (!sensitiveFiles || sensitiveFiles.length === 0) return;

    const gitignorePath = path.join(rootDir, '.gitignore');
    let existingContent = '';

    try {
        existingContent = await fs.readFile(gitignorePath, 'utf8');
    } catch (e) {
        // .gitignore doesn't exist yet
    }

    const existingLines = new Set(
        existingContent.split(/\r?\n/).map(line => line.trim())
    );

    const newEntries = [];

    for (const filePath of sensitiveFiles) {
        // Normalize path separators to forward slashes for cross-platform .gitignore support
        const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
        if (!existingLines.has(relativePath)) {
            newEntries.push(relativePath);
        }
    }

    if (newEntries.length === 0) {
        return;
    }

    const appendContent = (existingContent.endsWith('\n') || existingContent === '' ? '' : '\n') +
        '# Added by Security CLI\n' +
        newEntries.join('\n') + '\n';

    await fs.appendFile(gitignorePath, appendContent);
}

module.exports = {
    scanProject,
    updateGitignore
};