import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Dirs21Config } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configFilePath = path.resolve(__dirname, '../../../data/dirs21_config.json');

const DEFAULT_CONFIG: Dirs21Config = {
  channel: 'dirs21',
  hotelId: '28491',
  username: 'lindengarten_api',
  password: '',
  endpointUrl: 'https://soap.dirs21.de/WebServiceV2/',
  environment: 'mock',
  isActive: true,
  pollingIntervalSeconds: 120,
  syncIntervalSeconds: 15,
  syncLookaheadDays: 365,
  updatedAt: new Date().toISOString(),
};

export function getDirs21Config(): Dirs21Config {
  try {
    if (fs.existsSync(configFilePath)) {
      const data = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err: any) {
    console.warn('Fehler beim Lesen von dirs21_config.json:', err.message);
  }
  return DEFAULT_CONFIG;
}

export function saveDirs21Config(partial: Partial<Dirs21Config>): Dirs21Config {
  const current = getDirs21Config();
  const updated: Dirs21Config = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  try {
    const dir = path.dirname(configFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configFilePath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Fehler beim Speichern von dirs21_config.json:', err.message);
  }

  return updated;
}
