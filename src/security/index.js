const scanner = require('./scanner');
const reporter = require('./reporter');
const git = require('../git');

async function runSecure() {
    try {
        console.log('🚀 Starting security scan...');
        const results = await scanner.scanProject();

        if (results.issues.length === 0) {
            console.log('✅ No security lapses found. Your project looks secure!');
            return;
        }

        console.log(`\n⚠️ Found ${results.issues.length} potential security lapses.`);

        console.log('📝 Generating security report...');
        await reporter.generateReport(results);

        console.log('🛡️ Updating .gitignore with sensitive files...');
        for (const file of results.sensitiveFiles) {
            await git.appendToGitignore(file);
        }

        console.log('\n✨ Security process complete.');
        console.log('Check "security-report.md" for detailed findings.');
    } catch (error) {
        console.error(`\n❌ Security scan failed: ${error.message}`);
        process.exit(1);
    }
}

module.exports = {
    runSecure
};
