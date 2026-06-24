export {
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_DEEPSEEK_REASONING_EFFORT,
  DEFAULT_DEEPSEEK_THINKING_ENABLED,
  DEEPSEEK_ENV_KEYS,
  createDefaultDeepSeekProviderConfig,
  loadDeepSeekProviderConfig,
  type DeepSeekConfigIssue,
  type DeepSeekConfigResult,
  type DeepSeekEnvironment,
  type DeepSeekProviderConfig,
} from "./config.js";
export {
  getDeepSeekApiKeyReadyState,
  redactDeepSeekApiKey,
  requireDeepSeekApiKey,
  type DeepSeekApiKeyIssue,
  type DeepSeekApiKeyReadyState,
  type DeepSeekApiKeyResult,
} from "./api-key.js";
