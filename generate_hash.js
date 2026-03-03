const crypto = require('crypto');

const password = process.argv[2];

if (!password) {
    console.log("Usage: node generate_hash.js <password>");
    process.exit(1);
}

const hash = crypto.createHash('sha256').update(password).digest('hex');
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
console.log(`\nAdd this to your .env file:`);
console.log(`MANAGER_PASSWORD_HASH=${hash}`);
