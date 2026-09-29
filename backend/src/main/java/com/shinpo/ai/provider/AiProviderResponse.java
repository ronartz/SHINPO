package com.shinpo.ai.provider;

public record AiProviderResponse(
        String content,
        boolean successful,
        String errorMessage,
        long latencyMs,
        String provider,
        String model
) {
    public static AiProviderResponse success(String content, long latencyMs, String provider, String model) {
        return new AiProviderResponse(content, true, null, latencyMs, provider, model);
    }

    public static AiProviderResponse failure(String errorMessage, long latencyMs, String provider, String model) {
        return new AiProviderResponse(null, false, errorMessage, latencyMs, provider, model);
    }
}
