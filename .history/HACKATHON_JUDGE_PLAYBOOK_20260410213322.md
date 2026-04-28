# Drishtikon - Hackathon Judge Playbook

## 1. System Overview

### Architecture at a glance
Drishtikon is a three-layer system:

1. Frontend (React + TypeScript + Vite)
- Captures user input.
- Calls backend endpoints.
- Visualizes source diversity, bias distribution, grouped claims, and consensus.

2. Backend (FastAPI)
- Orchestrates the entire pipeline.
- Fetches and normalizes multi-provider news data.
- Handles bias tagging, claim extraction, claim grouping, consensus scoring, and summarization.

3. AI and ML layer
- Groq LLM for claim extraction and neutral summarization.
- Local sentence-transformers embeddings for semantic claim grouping.

### Why this architecture
- Security: API keys stay in backend.
- Modularity: Providers and models can be swapped independently.
- Reliability: Backend handles fallback, retries, deduplication, and quality controls.
- Explainability: Every major stage has visible artifacts in the response.

---

## 2. End-to-End Pipeline (Detailed)

### User Query -> Backend -> News APIs -> Bias -> Claims -> Embeddings -> Similarity -> Grouping -> Consensus -> Summary -> Frontend

### Step 1: User input
What happens:
- User enters a keyword query or social media URL.
- Frontend sends GET /search?q=...

Why needed:
- Single entry point keeps behavior consistent.

Alternatives:
- Client-side direct provider calls.

Tradeoff:
- Backend hop adds minimal latency but gives strong control and security.

### Step 2: Social URL detection (conditional)
What happens:
- Backend detects Instagram/X/Facebook/YouTube/TikTok URLs.
- If social URL is detected, it extracts a factual claim and uses it as effective_query.
- If not social, effective_query is original query.

Why needed:
- URLs themselves are poor search terms for news APIs.

Alternatives:
- Always run LLM extraction.

Tradeoff:
- Conditional branch reduces cost and avoids unnecessary LLM calls.

### Step 3: Multi-provider fetch
What happens:
- Backend concurrently calls NewsData, GNews, Currents, and NewsAPI.
- Supports multiple keys per provider via key rotation.
- Provider cooldown prevents repeated failure spam on quota/auth errors.

Why needed:
- Better coverage, diversity, and resilience.

Alternatives:
- Single provider.

Tradeoff:
- More integration complexity for stronger coverage quality.

### Step 4: Normalization and cleaning
What happens:
- Standard schema per article: title, description, source, bias, link, pubDate, image_url, provider.
- URL validation and text cleaning.
- English-likeness filtering.

Why needed:
- Downstream logic requires consistent structure.

Alternatives:
- Full ETL with async queue.

Tradeoff:
- Simpler synchronous path now, less robust than full ETL at very high scale.

### Step 5: Deduplication
What happens:
- Remove true duplicates while preserving same-story coverage from different outlets.

Why needed:
- Avoid repeated content while maintaining source diversity.

Alternatives:
- URL-only dedupe, embedding dedupe.

Tradeoff:
- Heuristic threshold is fast but can still miss tricky cases.

### Step 6: Bias detection
What happens:
- Source name normalized and matched to LEFT/CENTER/RIGHT/UNKNOWN.

Why needed:
- Core product value is perspective spectrum.

Alternatives:
- Article-level ML bias model.

Tradeoff:
- Source-level map is cheap and transparent but coarse.

### Step 7: Claim extraction
What happens:
- For each selected article, LLM extracts short factual claims in JSON mode.

Why needed:
- Consensus is computed on claims, not full paragraphs.

Alternatives:
- Pure regex/rules extraction.

Tradeoff:
- LLM is flexible and strong, but can hallucinate or omit edge details.

### Step 8: Embeddings
What happens:
- Claims are embedded using all-MiniLM-L6-v2.
- Cosine similarity matrix computed across claim vectors.

Why needed:
- Captures semantic similarity across paraphrased claims.

Alternatives:
- Token overlap methods only.

Tradeoff:
- More compute for better semantic grouping quality.

### Step 9: Similarity threshold and grouping
What happens:
- If cosine similarity >= threshold (default 0.75), claims are unioned into same group.
- Union-find builds connected components.

Why needed:
- Converts fragmented claims into coherent agreement buckets.

Alternatives:
- K-means, DBSCAN, hierarchical clustering.

Tradeoff:
- Threshold + union-find is simple and explainable but not stance-aware.

### Step 10: Consensus score
What happens:
- Consensus = largest_group_size / total_claims * 100

Why needed:
- Gives interpretable single metric for factual convergence.

Alternatives:
- Entropy-based or source-weighted scores.

Tradeoff:
- Very interpretable, but not full truth confidence.

### Step 11: Neutral summary
What happens:
- LLM receives capped set of source-tagged articles and produces concise neutral summary.

Why needed:
- User-friendly synthesis of multi-source reporting.

Alternatives:
- Extractive summary only.

Tradeoff:
- Better readability with abstractive summary, but hallucination risk exists.

### Step 12: Frontend rendering
What happens:
- Analysis page displays summary, grouped claims, source comparisons by bias, consensus chart, and source links.

Why needed:
- Transparency and trust through interpretable views.

Alternatives:
- Raw JSON/table output.

Tradeoff:
- Rich UI takes effort but substantially improves comprehension.

---

## 3. News Fetching

### How multiple news APIs work
- Concurrent fan-out to four providers.
- Provider adapters map fields into common schema.
- Query sanitization and fallback variants improve retrieval.

### Why backend handles it
- Key secrecy.
- One stable API contract for frontend.
- Centralized retry, dedupe, and fallback policies.

### Rate limits and optimization
- Multi-key rotation per provider.
- Temporary cooldown on repeated auth/quota failures.
- Trending endpoint uses 10-minute cache TTL.
- Capped article count limits latency and cost.

---

## 4. Bias Detection

### What media bias means here
- Outlet-level leaning proxy, not truth label.

### How hardcoded mapping works
- Normalize source string to alphanumeric token.
- Match against known map with partial fallback.
- Return LEFT/CENTER/RIGHT/UNKNOWN.

### Limitations
- Article-level nuance is lost.
- Unknown sources reduce precision.
- Regional context can differ from global labels.

### Improvements
- Source prior + article-level classifier hybrid.
- Public bias datasets and periodic recalibration.
- Confidence scores and audit workflow.

---

## 5. Claim Extraction (LLM)

### Why LLM is needed
- Claims are phrased differently across outlets.
- Rules-only extraction misses paraphrases and context.

### Prompt engineering choices
- Neutral analyst framing.
- Hard constraints: factual only, no speculation/opinion.
- Structured JSON output target.

### JSON mode
- Lower parsing ambiguity.
- Cleaner downstream processing.

### Failure handling
- LLM/API failure returns safe fallback.
- Social mode falls back to raw input if extraction fails.

### Cost optimization
- Fast model choice.
- Low temperature.
- Capped article and claim counts.

---

## 6. Embeddings (Important)

### What embeddings are mathematically
- A sentence is mapped to dense vector v in R^d.
- Semantically similar sentences have vectors with similar direction.

### How sentence-transformers works
- Transformer encodes contextual token relationships.
- Pooling creates sentence-level representation.
- Optional normalization stabilizes cosine comparisons.

### Why all-MiniLM-L6-v2
- Strong quality-speed tradeoff.
- Small enough for local/server use in hackathon constraints.

### Vector dimensions
- all-MiniLM-L6-v2 typically outputs 384-dimensional vectors.

### Why local embeddings instead of external embedding APIs
- Lower variable cost.
- Better privacy.
- Fewer external dependencies.

### Performance considerations
- Model is loaded once and reused.
- Claim count limits bound matrix size.
- Fallback exact-match grouping exists if embedding model unavailable.

---

## 7. Cosine Similarity

### Intuition and formula
Cosine similarity measures the angle between vectors, not absolute magnitude.

cosine(u, v) = (u dot v) / (||u|| * ||v||)

### Why cosine over Euclidean distance
- Direction matters more than vector magnitude in semantic spaces.
- Works very well with normalized embeddings.

### Threshold selection (0.75)
- Empirical middle ground between over-merging and over-splitting.
- Configurable at runtime.

### Edge cases
- Negation may still appear close semantically.
- Numeric differences can be under-penalized.
- Very short claims can be ambiguous.

---

## 8. Claim Grouping

### How grouping works
1. Embed all cleaned claims.
2. Compute pairwise cosine matrix.
3. Connect claim pairs above threshold.
4. Use union-find to build components.
5. Each component becomes one representative claim group.

### Why threshold-based grouping
- Simple, deterministic, and explainable.

### Alternatives
- K-means: requires fixed K.
- DBSCAN: handles noise but parameter-sensitive.
- Hierarchical clustering: richer structure but heavier compute.

### Tradeoffs
- Current approach is fast and transparent.
- Advanced methods may improve quality at complexity cost.

---

## 9. Consensus Score

### Formula
consensus = (largest claim group size / total grouped claims) * 100

### What it represents
- Share of claims converging around the dominant semantic narrative.

### Strengths
- Easy to interpret.
- Stable and lightweight.

### Weaknesses
- Not a factual truth guarantee.
- Sensitive to extraction and grouping quality.

### Alternatives
- Source-weighted agreement.
- Entropy-based diversity metrics.
- Stance-aware consensus.

---

## 10. Neutral Summary

### Multi-source summarization
- Builds compact prompt from capped source-labeled articles.
- LLM generates concise neutral synthesis.

### Bias reduction strategy
- Prompt explicitly asks for factual neutrality.
- Rejects speculation and emotional framing.

### Risks
- Hallucination.
- Missing minority but relevant details.

### Improvements
- Add citation-grounded summary output.
- Add self-check pass against extracted claims.

---

## 11. Frontend

### Component-based structure
- Home: query entry + trending preview.
- Trending: category tabs and story cards.
- Analysis: full pipeline results display.

### Routing
- BrowserRouter with routes for /, /trending, /analysis.

### Data flow
- Query -> /analysis?q=... -> backend /search response -> UI sections.

### Visualization
- Consensus uses Chart.js doughnut via react-chartjs-2.
- Bias distribution uses custom segmented bars.

---

## 12. Performance and Optimization

### Why limits exist
- Limiting articles and claims keeps latency manageable.
- Prevents LLM and embedding costs from scaling uncontrollably.

### Caching strategy
- Trending endpoint stores in-memory cache for 10 minutes.

### Latency considerations
- External API network time dominates early stage.
- LLM and embedding stages dominate compute stage.

### Scaling strategy
- Move heavy steps to background workers.
- Add Redis for cross-instance caching.
- Add persistent storage for article snapshots.

---

## 13. Security and Design Decisions

### Why API keys are backend-only
- Prevents key leakage and abuse.

### Why backend handles AI
- Centralized prompt/version control.
- Consistent fallback and policy behavior.

### Separation of concerns
- Frontend: UX and presentation.
- Backend: orchestration and policy.
- AI/ML: semantic understanding and synthesis.

---

## 14. Limitations

1. Bias labels are outlet-level approximations.
2. LLM outputs can still hallucinate or oversimplify.
3. Provider coverage varies by topic/time/region.
4. Small article samples can skew consensus.
5. Threshold-based grouping is not contradiction-aware.
6. Consensus is agreement intensity, not objective truth.

---

## 15. Future Improvements

1. Contradiction-aware or stance-aware claim clustering.
2. Citation-grounded summaries with evidence links.
3. Real-time streaming updates as provider responses arrive.
4. User personalization by region, outlet preference, and topic interests.
5. Fact-check API integration for claim verification.
6. Provider health dashboard and confidence scoring.

---

## 16. Likely Judge Questions and Strong Answers

### Q1. Why embeddings instead of keyword matching?
A: Embeddings capture meaning, so paraphrased claims can be grouped even when wording differs.

### Q2. Why cosine similarity?
A: In embedding spaces, direction is more meaningful than vector length; cosine directly captures directional similarity.

### Q3. Why threshold 0.75?
A: It balances precision and recall for semantic grouping and is configurable for tuning.

### Q4. Is consensus score truth?
A: No. It measures cross-source agreement intensity, not absolute factual truth.

### Q5. How do you reduce political bias in output?
A: We show source-side bias transparently and summarize across multiple outlets with neutral prompting.

### Q6. What if one provider fails?
A: Pipeline continues with remaining providers. We also use key rotation and provider cooldown.

### Q7. Why backend fan-out instead of frontend fan-out?
A: Security, centralized normalization, consistent policy logic, and simpler frontend contract.

### Q8. Why use an LLM for claim extraction?
A: Claims are linguistically diverse and paraphrased; LLM extraction is robust compared with regex-only rules.

### Q9. How do you control LLM inconsistency?
A: Structured prompts, JSON mode, low temperature, and bounded input sizes.

### Q10. Why not train a custom model now?
A: For hackathon timeline, modular off-the-shelf components deliver faster and still high quality.

### Q11. How scalable is this architecture?
A: API layer is horizontally scalable; heavy stages can be moved to async workers with cache and queues.

### Q12. How do you handle social media links?
A: Detect platform URL -> extract factual claim -> run exact same news consensus pipeline.

### Q13. How do you handle noisy or quoted inputs?
A: Query sanitization and variant generation improve provider search robustness.

### Q14. Why include multiple providers?
A: Better source diversity, fewer blind spots, and resilience to rate limits/outages.

### Q15. What is your biggest current technical risk?
A: Quality variance from providers and LLM outputs. We mitigate with fallbacks and explicit uncertainty indicators.

### Q16. How do you ensure explainability?
A: We expose grouped claims, source lists, bias labels, and consensus components in UI.

### Q17. How is cost managed?
A: Capped article/claim counts, fast models, and minimal LLM calls only where needed.

### Q18. What would you improve first for production?
A: Evidence-linked summaries and contradiction-aware clustering.

### Q19. Why local embeddings over API embeddings?
A: Lower recurring cost, better privacy, and predictable latency once loaded.

### Q20. How do you validate quality?
A: Cross-check grouped claims against original source links and monitor agreement behavior across topics.

---

## 17. One-Minute Demo Script

We aggregate news from four providers, normalize and deduplicate it, map sources to a political-bias spectrum, extract factual claims, and semantically group those claims using sentence embeddings plus cosine similarity. Then we compute a consensus score based on the dominant claim group and generate a neutral multi-source summary. For social media URLs, we first extract a factual claim and run the same pipeline. The UI makes all this explainable: source links, bias distribution, grouped claims, and a consensus chart.
