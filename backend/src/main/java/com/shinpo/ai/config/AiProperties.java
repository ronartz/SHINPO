package com.shinpo.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "shinpo.ai")
public class AiProperties {

    private boolean enabled = true;
    private String provider = "ollama";
    private OllamaProperties ollama = new OllamaProperties();

    public static class OllamaProperties {
        private String baseUrl = "http://localhost:11434";
        private String model = "qwen3:4b";
        private int timeoutSeconds = 30;

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getModel() {
            return model;
        }

        public void setModel(String model) {
            this.model = model;
        }

        public int getTimeoutSeconds() {
            return timeoutSeconds;
        }

        public void setTimeoutSeconds(int timeoutSeconds) {
            this.timeoutSeconds = timeoutSeconds;
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public OllamaProperties getOllama() {
        return ollama;
    }

    public void setOllama(OllamaProperties ollama) {
        this.ollama = ollama;
    }
}
