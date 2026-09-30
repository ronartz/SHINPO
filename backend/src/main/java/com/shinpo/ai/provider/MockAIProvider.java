package com.shinpo.ai.provider;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class MockAIProvider implements AIProvider {

    private final AtomicBoolean available = new AtomicBoolean(true);
    private final AtomicReference<String> cannedResponse = new AtomicReference<>(null);
    private final List<AiProviderRequest> recordedRequests = new ArrayList<>();

    @Override
    public AiProviderResponse generate(AiProviderRequest request) {
        synchronized (recordedRequests) {
            recordedRequests.add(request);
        }
        if (!available.get()) {
            return AiProviderResponse.failure("Mock provider unavailable", 1L, "mock", "mock-model-v1");
        }
        String content = cannedResponse.get();
        if (content == null) {
            content = """
                    {
                      "reply": "Mock AI response: Strategy executed successfully.",
                      "suggestionType": "TACTICAL_ASSISTANT",
                      "structuredCard": null
                    }
                    """;
        }
        return AiProviderResponse.success(content, 2L, "mock", "mock-model-v1");
    }

    @Override
    public boolean isAvailable() {
        return available.get();
    }

    @Override
    public String getProviderName() {
        return "mock";
    }

    @Override
    public String getModelName() {
        return "mock-model-v1";
    }

    public void setAvailable(boolean isAvailable) {
        this.available.set(isAvailable);
    }

    public void setCannedResponse(String response) {
        this.cannedResponse.set(response);
    }

    public List<AiProviderRequest> getRecordedRequests() {
        synchronized (recordedRequests) {
            return List.copyOf(recordedRequests);
        }
    }

    public void reset() {
        this.available.set(true);
        this.cannedResponse.set(null);
        synchronized (recordedRequests) {
            this.recordedRequests.clear();
        }
    }
}
