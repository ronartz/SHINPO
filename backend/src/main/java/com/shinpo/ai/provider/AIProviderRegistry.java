package com.shinpo.ai.provider;

import com.shinpo.ai.config.AiProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AIProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(AIProviderRegistry.class);

    private final Map<String, AIProvider> providers = new ConcurrentHashMap<>();
    private final AiProperties aiProperties;

    public AIProviderRegistry(List<AIProvider> providerList, AiProperties aiProperties) {
        this.aiProperties = aiProperties;
        if (providerList != null) {
            for (AIProvider provider : providerList) {
                registerProvider(provider);
            }
        }
    }

    public void registerProvider(AIProvider provider) {
        if (provider != null && provider.getProviderName() != null) {
            providers.put(provider.getProviderName().toLowerCase(), provider);
            log.info("Registered AI provider: {} (model: {})", provider.getProviderName(), provider.getModelName());
        }
    }

    public Optional<AIProvider> getProvider(String name) {
        if (name == null) return Optional.empty();
        return Optional.ofNullable(providers.get(name.toLowerCase()));
    }

    public AIProvider getActiveProvider() {
        String configured = aiProperties != null ? aiProperties.getProvider() : null;
        if (configured != null) {
            AIProvider provider = providers.get(configured.toLowerCase());
            if (provider != null) {
                return provider;
            }
        }
        // Fallback: look for available provider
        return providers.values().stream()
            .filter(provider -> provider.isAvailable())
                .findFirst()
                .orElse(providers.values().stream().findFirst().orElse(null));
    }

    public Map<String, AIProvider> getAllProviders() {
        return Collections.unmodifiableMap(providers);
    }

    public boolean isAnyAvailable() {
        return providers.values().stream().anyMatch(provider -> provider.isAvailable());
    }
}
