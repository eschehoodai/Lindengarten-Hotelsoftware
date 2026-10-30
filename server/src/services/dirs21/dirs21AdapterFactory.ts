import { Dirs21Adapter, Dirs21Config } from './types.js';
import { Dirs21MockAdapter } from './dirs21MockAdapter.js';
import { Dirs21SoapAdapter } from './dirs21SoapAdapter.js';

export function getDirs21Adapter(config: Dirs21Config): Dirs21Adapter {
  if (config.environment === 'mock') {
    return new Dirs21MockAdapter();
  }
  return new Dirs21SoapAdapter();
}
