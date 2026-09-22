# AI visibility providers

Citation monitoring runs once per configured provider. A missing key disables only that provider; passive crawler and referral tracking never needs model API credentials.

| Surface | Environment variable | Native search API |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | Responses web search |
| Claude | `ANTHROPIC_API_KEY` | Messages web search |
| Grok | `XAI_API_KEY` | Responses web search |
| Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` | Google Search grounding |
| Meta Muse Spark | `META_MODEL_API_KEY` | Meta Responses search grounding |
| Mistral | `MISTRAL_API_KEY` | Conversations web search |

Each account needs API billing or credits. Anthropic also requires web search to be enabled for the organization. The keys are server-only Nuxt runtime config and must be set in every environment that executes the weekly Nitro task.

Adding a key is enough to enable an adapter after an application restart or deployment. Removing it disables new runs without deleting historical results. The visibility overview API reports every provider's model and `configured` state without exposing credentials.

Provider runs are independent. A partial outage is stored as a failed run for that provider while successful answers and citations from the others remain available. Citation parsers intentionally ignore merely retrieved search results and persist only sources referenced by the final answer.
