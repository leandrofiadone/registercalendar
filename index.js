import readline from 'readline';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Agent } from './agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, 'config.json');

if (!existsSync(configPath)) {
  console.error('Falta config.json. Copia config.json y agrega tu clave de Anthropic.');
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'));

if (!config.anthropic_api_key || config.anthropic_api_key.startsWith('TU_')) {
  console.error('Agrega tu anthropic_api_key en config.json');
  process.exit(1);
}

const agent = new Agent(config);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

const notionStatus = config.notion_api_key ? 'Notion conectado' : 'Notion desactivado (sin clave)';

console.log('');
console.log('  Gym Tracker');
console.log(`  ${notionStatus}`);
console.log('  Escribe lo que hiciste. "resumen" para ver hoy. Ctrl+C para salir.');
console.log('');

function prompt() {
  rl.question('> ', async (input) => {
    input = input.trim();
    if (!input) return prompt();

    try {
      const response = await agent.chat(input);
      if (response) console.log(`\n${response}\n`);
    } catch (err) {
      console.error(`\nError: ${err.message}\n`);
    }

    prompt();
  });
}

prompt();
