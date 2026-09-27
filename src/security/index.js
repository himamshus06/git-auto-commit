const scanner = require('./scanner');
const reporter = require('./reporter');
const git = require('../git');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');

async function runSecure() {
    const rl = readline.createInterface({ input, output });
    try {
        console.log('🚀 Starting security scan...');
        const results = await scanner.scanProject();

        if (results.issues.length === 0) {
            console.log('✅ No security lapses found. Your project looks secure!');
            rl.close();
            return;
        }

        console.log(`\n⚠️  Security Scan Results:`);
        console.log('--------------------------------------------------');
        results.issues.forEach((issue, index) => {
            console.log(`${index + 1}. [${issue.type}] - ${issue.file}`);
        });
        console.log('--------------------------------------------------');
        console.log(`Total Issues Found: ${results.issues.length}`);
        console.log(`Sensitive Files to Ignore: ${results.sensitiveFiles.length}`);

        console.log('\nAvailable Actions:');
        console.log('1. Generate detailed Markdown report (security-report.md)');
        console.log('2. Automatically add sensitive files to .gitignore');
        console.log('3. Do nothing and exit');

        // Check if stdin is a TTY. If not (like in a pipe), we might need to handle it.
        const choice = await rl.question('\nWhich actions would you like to take? (e.g., "1,2" for both, "1" for report only, "3" to exit): ');

        const selectedActions = choice.split(',').map(s => s.trim());

        if (selectedActions.includes('1')) {
            console.log('📝 Generating security report...');
            await reporter.generateReport(results);
            console.log('✅ Report saved to security-report.md');
        }

        if (selectedActions.includes('2')) {
            console.log('🛡️  Updating .gitignore with sensitive files...');
            for (const file of results.sensitiveFiles) {
                await git.appendToGitignore(file);
            }
            console.log('✅ .gitignore updated.');
        }

        if (selectedActions.includes('3') || selectedActions.length === 0) {
            console.log('Skipping all actions.');
        }

        console.log('\n✨ Security process complete.');
    } catch (error) {
        // If readline was already closed, we don't need to log this specific error as a failure
        if (error.message.includes('readline was closed')) {
            // Silence this error
        } else {
            console.error(`\n❌ Security scan failed: ${error.message}`);
            process.exit(1);
        }
    } finally {
        rl.close();
    }
}

module.exports = {
    runSecure
};
