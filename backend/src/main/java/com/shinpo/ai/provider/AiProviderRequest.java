package com.shinpo.ai.provider;

import java.util.Map;

public record AiProviderRequest(
        String systemPrompt,
        String userPrompt,
        Map<String, Object> contextData,
        boolean jsonMode,
        Double temperature
) {
    public static AiProviderRequest of(String systemPrompt, String userPrompt, Map<String, Object> contextData) {
        return new AiProviderRequest(systemPrompt, userPrompt, contextData, true, 0.2);
    }

    public static AiProviderRequest of(String systemPrompt, String userPrompt) {
        return new AiProviderRequest(systemPrompt, userPrompt, Map.of(), true, 0.2);
    }
}
