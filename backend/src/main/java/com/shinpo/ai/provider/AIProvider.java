package com.shinpo.ai.provider;

public interface AIProvider {

    AiProviderResponse generate(AiProviderRequest request);

    boolean isAvailable();

    String getProviderName();

    String getModelName();
}
