# SHINPO — EONPAI Cloud AI Provider Verification Report
## Google Gemini 3.6 Flash Integration, Header Security & Truthful Fallback

**Date:** 2026-10-20  
**Reviewer Role:** AI Systems Engineer & Application Security Specialist  
**Workspace:** `/home/eonx/Projects/SHINPO`  
**Status:** **LOCALLY TESTED & API-CONTRACT VERIFIED**

---

## 1. Executive Summary

EONPAI serves as SHINPO's intelligent productivity copilot. In previous iterations, EONPAI depended strictly on a local Ollama instance running on the developer's laptop (`localhost:11434`), requiring a local GPU and active development environment. To allow friends to use SHINPO independently on their laptops with zero local AI dependencies, a cloud AI provider was implemented using Google's Gemini REST API.

During independent verification, three critical findings were uncovered and resolved:
1. **Model Deprecation / Operational Life Check:** Official Google Gemini documentation confirms that `gemini-2.0-flash` had a scheduled shutdown date of **June 1, 2026**, with the recommended replacement being **`gemini-3.6-flash`**. The default model was upgraded to `gemini-3.6-flash`.
2. **Credential Leakage in URL Query Parameters:** The initial implementation transmitted the API key in the URL query string (`?key=...`). Spring RestTemplate debug logging and exception traces (`RestClientResponseException`) logged the full URL, exposing the raw API key. This was remediated by transmitting the API key exclusively via the standard **`x-goog-api-key`** HTTP request header.
3. **Missing `@Autowired` Constructor Crash:** In Spring Boot 4.1.1, `GeminiProvider` contained two public constructors without explicit `@Autowired` annotation, causing Spring to seek a non-existent zero-argument constructor and crash during bean instantiation (`NoSuchMethodException`). `@Autowired` was added to the primary injection constructor.

---

## 2. Gemini model and provider-account cost

Sourced directly from current official Google Gemini API documentation:

| Property | Gemini 2.0 Flash (Legacy) | Gemini 3.6 Flash (Active) |
|---|---|---|
| **Model Code** | `gemini-2.0-flash` | `gemini-3.6-flash` |
| **Operational Status** | **Shutdown June 1, 2026** | **Active Stable Flash Model** (Latest update July 2026) |
| **Input Context Window** | 1,048,576 tokens | 1,048,576 tokens |
| **Max Output Tokens** | 8,192 tokens | 65,536 tokens |
| **Cost / quota** | Varies by provider account and model terms | Varies by provider account, model terms, and billing/quota configuration |
| **Recommended Headers** | `x-goog-api-key` | `x-goog-api-key` |
| **Pricing / Quota** | Deprecated | Standard free tier available in Google AI Studio |

---

## 3. Implementation Details & Hardening

### 3.1 Secure Header Authentication (`GeminiProvider.java`)
```java
// Endpoint has zero query parameters; credentials are never exposed in URL logs
String endpoint = GEMINI_API_BASE + "/models/" + model + ":generateContent";

HttpHeaders headers = new HttpHeaders();
headers.setContentType(MediaType.APPLICATION_JSON);
headers.set("x-goog-api-key", apiKey);
HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);
```

### 3.2 Error Sanitization & Safe Failure
```java
} catch (RestClientException e) {
    long latencyMs = System.currentTimeMillis() - start;
    log.warn("Gemini provider request failed (model={}): {}", model, e.getMessage());
    String userError = (e.getMessage() != null && e.getMessage().contains("429"))
            ? "Gemini rate limit reached. Please wait a moment."
            : "Gemini service temporarily unavailable.";
    return AiProviderResponse.failure(userError, latencyMs, "gemini", model);
} catch (Exception e) {
    long latencyMs = System.currentTimeMillis() - start;
    log.error("Unexpected error in GeminiProvider", e);
    return AiProviderResponse.failure("Internal provider error occurred", latencyMs, "gemini", model);
}
```

### 3.3 Truthful Degradation & Deterministic Fallback
When no Gemini API key is configured or the external network is unreachable:
- EONPAI does **not** crash or throw HTTP 500 errors.
- `AiService` automatically activates its deterministic tactical assistant rule engine.
- Responses clearly state their source and never fabricate completed system actions or hallucinate artificial background operations.

---

## 4. Test Verification Evidence

```bash
cd backend && ./mvnw test -Dtest=GeminiProviderTests
```

**Results:**
- `defaultModelUsesConfiguredCloudModel`: **PASS**
- `isAvailable_NoApiKey_ReturnsFalse`: **PASS**
- `isAvailable_ValidProbe_ReturnsTrue`: **PASS** (Verifies probe sends `x-goog-api-key` header to `/models?pageSize=1`)
- `isAvailable_ProbeFails_ReturnsFalse`: **PASS**
- `generate_Success`: **PASS** (Verifies JSON response extraction from `gemini-3.6-flash`)
- `generate_MissingApiKey`: **PASS**
- `generate_RateLimitOrError`: **PASS** (Handles HTTP 429 gracefully with user-friendly rate limit message)
- `metadata`: **PASS** (Provider="gemini", Model="gemini-3.6-flash")

**Total:** 8 tests run, 8 passed, 0 failures.

---

## 5. Verification Verdict

### **LOCALLY TESTED & API-CONTRACT VERIFIED — NOT LIVE-PROVIDER ACCEPTED**
The Gemini provider sends its key in the `x-goog-api-key` header and is covered by mocked API-contract tests. Provider charges and quotas depend on the user's Google account and current terms; configure billing limits there. Live generation requires a valid server-side `GEMINI_API_KEY` and remains unverified in production.

