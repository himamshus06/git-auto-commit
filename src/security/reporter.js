const fs = require('fs').promises;
const path = require('path');

async function generateReport(results) {
    const date = new Date().toLocaleDateString();
    const summary = `
# Security Scan Report - ${date}

## 🚨 Summary
- **Total Issues Found:** ${results.issues.length}
- **Sensitive Files Flagged:** ${results.sensitiveFiles.length}

## 🔍 Detailed Findings
${results.issues.length === 0 ? 'No critical issues detected.' : results.issues.map(issue => `
### \`${issue.file}\`
- **Issue:** Potential ${issue.type} detected.
- **Confidence:** ${issue.confidence}
- **Suggested Action:** Rotate this key immediately and remove it from git history.`).join('\n')}

## 🛠 Actions Taken
${results.sensitiveFiles.length === 0 ? 'No files needed to be ignored.' : results.sensitiveFiles.map(file => `- Added \`${path.relative(process.cwd(), file)}\` to .gitignore`).join('\n')}
`;

    await fs.writeFile('security-report.md', summary);
}

module.exports = {
    generateReport
};
