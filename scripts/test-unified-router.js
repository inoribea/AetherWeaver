const path = require('path'); const fs = require('fs');
const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'models-config.json'), 'utf-8'));
console.assert(config.models['claude-sonnet-4-native'], 'FAIL: claude-sonnet-4-native missing');
console.assert(config.models['claude-sonnet-4-native'].type === 'anthropic', 'FAIL: wrong type');
console.assert(config.models['command-r-plus'], 'FAIL: command-r-plus missing');
console.assert(config.models['command-r-plus'].type === 'cohere', 'FAIL: wrong type');
const types = {}; for (const [id, m] of Object.entries(config.models)) { types[m.type] = (types[m.type] || 0) + 1; }
console.log('Types:', JSON.stringify(types)); console.assert(types.anthropic === 1); console.assert(types.cohere === 1);
console.log('PASS');
