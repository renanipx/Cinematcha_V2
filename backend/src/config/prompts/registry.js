const logger = require('../../utils/logger');
const promptV100 = require('./templates/v1.0.0');
const promptV110 = require('./templates/v1.1.0');

const registry = {
  '1.0.0': promptV100,
  '1.1.0': promptV110
};

/**
 * Dynamically loads system/user prompt configurations from the registry
 * @param {string} version - Requested SemVer string (e.g. '1.0.0')
 * @param {string} locale - Locale override ('en' or 'pt')
 * @param {string} promptInput - Natural language user prompt
 * @returns {object} - Compiled prompts and deep copied hyperparameters
 */
function getPrompt(version, locale = 'en', promptInput = '') {
  const selectedVersion = process.env.PROMPT_VERSION_OVERRIDE || version || '1.0.0';
  const promptConfig = registry[selectedVersion];

  if (!promptConfig) {
    throw new Error(`[PROMPT] Requested version '${selectedVersion}' not found in registry.`);
  }

  const selectedLocale = locale === 'pt' ? 'pt' : 'en';
  const localeConfig = promptConfig.locales[selectedLocale] || promptConfig.locales['en'];

  // Replace placeholder
  const compiledUserPrompt = localeConfig.userPrompt.replace('{{prompt}}', promptInput);

  logger.info(`[AI_ORCH] PROMPT_LOAD - Version: ${selectedVersion}, Locale: ${selectedLocale}`);

  // Deep copy the parameters to avoid mutation of registry reference
  const parameters = JSON.parse(JSON.stringify(promptConfig.parameters));

  return {
    systemPrompt: localeConfig.systemPrompt,
    userPrompt: compiledUserPrompt,
    parameters
  };
}

module.exports = {
  getPrompt,
  registry
};
