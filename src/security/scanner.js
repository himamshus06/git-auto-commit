const fs = require('fs').promises;
const path = require('path');
const ai = require('../ai');

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const SENSITIVE_FILENAME_PATTERNS = [/^\.env(\..+)?$/i, /id_rsa/i, /credentials\.json$/i];

const SECRET_PATTERNS = {
    'AWS Access Key': /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    'AWS Secret Key': /aws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9\/+]{40}['"]?/i,
    'GitHub Token': /(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,
    'Stripe API Key': /sk_(live|test)_[0-9a-zA-Z]{24}/,
    'Private Key': /-----BEGIN (?:RSA|OPENSSH|EC|PGP|DSA)? PRIVATE KEY-----/,
    'Generic API Key': /(api[_-]?key|secret|token|auth|password)\s*[:=]\s*['"](?!\$\{)[A-Za-z0-9\-_]{16,128}['"]/i,
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

async function scanProject(dir = process.cwd()) {
    const issues = [];
    const sensitiveFiles = new Set();
    const provider = ai.getAIProvider();

    async function walk(currentDir) {
        const files = await fs.readdir(currentDir, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(currentDir, file.name);

            if (file.isDirectory()) {
                if (['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'].includes(file.name)) continue;
                await walk(fullPath);
            } else if (file.isFile()) {
                if (['.gitignore', 'security-report.md', 'package-lock.json'].includes(file.name)) continue;

                // 1. Check for sensitive filenames directly
                if (SENSITIVE_FILENAME_PATTERNS.some(p => p.test(file.name))) {
                    issues.push({ file: fullPath, type: 'Sensitive File Exposed', confidence: 'High' });
                    sensitiveFiles.add(fullPath);
                    continue;
                }

                // 2. Prevent loading huge/binary files
                const stats = await fs.stat(fullPath);
                if (stats.size > MAX_FILE_SIZE_BYTES) continue;

                const content = await fs.readFile(fullPath, 'utf8');

                for (const [type, regex] of Object.entries(SECRET_PATTERNS)) {
                    const match = content.match(regex);
                    if (match) {
                        const matchedValue = match[0];
                        
                        // 3. Skip low-entropy strings (human placeholders)
                        if (type.includes('Key') || type.includes('Token')) {
                            const entropy = calculateEntropy(matchedValue);
                            if (entropy < 3.0) continue; 
                        }

                        // 4. Verify with AI using a redacted snippet
                        const isReal = await verifyWithAI(provider, content, match, type);
                        if (isReal) {
                            issues.push({ file: fullPath, type, confidence: 'High' });
                            sensitiveFiles.add(fullPath);
                            break; // Stop matching other patterns on the same file instance if desired
                        }
                    }
                }
            }
        }
    }

    await walk(dir);
    return { issues, sensitiveFiles: Array.from(sensitiveFiles) };
}

async function verifyWithAI(provider, content, match, type) {
    const index = match.index;
    const rawValue = match[0];

    // Mask value before sending to external API
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
        return true; // Fallback to safe side on API error
    }
}

module.exports = { scanProject };