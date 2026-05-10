---
name: token-optimizer
description: Reduce LLM token consumption and cost across this codebase — prompt design, context pruning, caching, model selection, structured output, retrieval over stuffing, and measuring tokens before/after. Trigger whenever the user mentions tokens, token cost, "AI bill", LLM cost, prompt length, context window, "Claude is slow", "cut the prompt", caching prompts, prompt caching, system prompt size, RAG vs. context, or "we're spending too much on AI".
---

# Token Optimizer

LLM features (chat assistants, AI search, smart filters, recommendations, summarization) are expensive at scale. Every prompt is a bill. Treat tokens like RAM — measure, budget, evict.

## When this skill applies

- Designing or refactoring an LLM-powered feature.
- Cutting cost on an existing feature that's exceeding its budget.
- Choosing between a big model + small prompt vs. small model + big prompt.
- Setting up prompt caching, RAG, or output schema enforcement.

This skill is generic; for Claude API specifics, point at the official docs (`https://docs.claude.com`).

## The four levers

1. **Fewer tokens in** — shorter prompt, smarter context, prompt caching.
2. **Fewer tokens out** — structured output, max tokens cap, "answer only" patterns.
3. **Cheaper tokens** — pick the smallest model that passes evals (Haiku → Sonnet → Opus).
4. **Fewer calls** — cache results, batch, debounce, or replace with a non-LLM solution.

The biggest wins almost always come from **lever 4**, not 1.

## Measure before you optimize

Build a tiny harness that, for a sample of real traffic, records:

- input_tokens, output_tokens
- model
- latency
- cost (input × $/MTok_in + output × $/MTok_out)
- a quality score from your eval set

Without this, every "optimization" is folklore. Measure for a week, then change one thing, then measure again.

## Lever 1: Fewer tokens in

### Strip the system prompt

System prompts grow over time as you add edge-case instructions. Audit yours quarterly:

- Cut examples that no longer fail.
- Cut prose that explains things the model already knows.
- Move static instructions to a **cached system prompt** (Anthropic prompt caching, OpenAI prompt caching). 90% cost discount on cache hits.

### Retrieve, don't stuff

If the prompt is "here are 200 products, recommend one", you're paying for the model to skim 200 products. Use embeddings + vector search to retrieve the top 10 candidates, then ask the model to rank.

```
Before: 200 product descriptions → 18,000 tokens × every request
After:  embeddings retrieval (cheap) + top 10 → 900 tokens × every request
```

### Compress context

For long context (chat history, doc): summarize older turns into a running summary. Keep the last ~6 turns verbatim, summarize the rest.

### Prompt caching

If you're sending the same big system prompt or doc on every request, mark it cacheable. Most providers now support this.

```python
# Anthropic example sketch
client.messages.create(
    model="claude-haiku-4-5",
    system=[
        {"type": "text", "text": LARGE_INSTRUCTIONS, "cache_control": {"type": "ephemeral"}},
    ],
    messages=[{"role": "user", "content": user_msg}],
)
```

Validate with the response's `usage` block (`cache_creation_input_tokens`, `cache_read_input_tokens`).

## Lever 2: Fewer tokens out

### Structured output

Free-form prose costs more than JSON. Force the model to return a schema:

```python
class CategoryClassification(BaseModel):
    category_id: str
    confidence: float
```

A classifier that returns `{"category_id":"cat_dresses","confidence":0.92}` is 8 tokens; the same answer in prose is 30+.

### Cap `max_tokens`

If you only need a yes/no, set `max_tokens=4`. If a rephrase, ~120. Default to too small and bump if you see truncation.

### "Answer only" prompting

```
You are a classifier. Output ONLY the category id from this list: [...]. No prose.
```

The model will still try to be helpful; the constraint trims the explanation.

## Lever 3: Cheaper tokens

Run your eval set against multiple model tiers. For most discovery / classification / summarization, the smaller model wins on cost-quality. Reserve the biggest model for:

- Multi-step reasoning where small models hallucinate.
- Long, careful drafting.
- Anything customer-facing where small mistakes are visible.

Don't pick by gut — pick by your eval score.

## Lever 4: Fewer calls

### Cache the result, not the prompt

If the input is deterministic, hash it and cache the response in Redis. Recommendations for `(user_id, category)` rarely change in a 10-minute window.

```
key = f"rec:{user_id}:{category}:v3"  # bump v3 when prompt changes
```

### Batch where the API allows

Some providers offer batch endpoints at 50% off with up to 24h SLA — perfect for non-realtime jobs (nightly product tagging, embedding refresh, moderation backlogs).

### Replace with a non-LLM solution

Some "AI features" don't need an LLM:

- Ranking → train a small ML model on your data.
- Spam / profanity → keyword + classifier model.
- Search → an actual search engine (`search-indexing`).
- Translation → a translation API (cheaper, faster, cached).

Use the LLM where it's irreplaceable — judgment, multi-step reasoning, generation.

## Patterns by feature

| Feature | Default approach | Optimization |
| --- | --- | --- |
| Product description generation | One-shot Sonnet | Cache by SKU + attributes; batch overnight |
| Search "did you mean" | Haiku, structured output | Cache by normalized query, 24h |
| Review summary | Haiku over top-N reviews | Recompute weekly, not per-view |
| Chat support bot | Sonnet, RAG over docs | Cache the system prompt; trim history |
| Image moderation | Vision model | Use AWS Rekognition / Cloudinary first; LLM only for ambiguous |

## Common mistakes to flag

- Sending the entire user history every turn (compress old turns).
- Pasting a 5000-line policy doc into every system prompt with no caching.
- Using the biggest model "just to be safe" without an eval.
- Calling the LLM inside a hot UI handler synchronously — debounce or move server-side.
- Asking the model to return Markdown when JSON would do.
- No `max_tokens` cap (one runaway response can cost more than the whole day).
- No telemetry on input/output tokens — flying blind.

## Checklist before shipping an LLM feature

- Token usage logged per request (input, output, cached, model, cost).
- An eval set exists; smaller models tested against it.
- Prompt caching enabled where the same prompt repeats.
- `max_tokens` is set, not unbounded.
- Output is structured (JSON / schema) wherever possible.
- A non-LLM fallback exists for rate-limited / outage cases.
- Cost per 1k requests is documented and alerted on.
