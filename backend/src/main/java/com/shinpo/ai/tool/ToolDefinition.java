package com.shinpo.ai.tool;

import java.util.Map;

/**
 * Public schema definition of an AI tool.
 * Exposes tool identity, purpose, and typed parameter requirements to callers and models.
 */
public record ToolDefinition(
        String name,
        String description,
        Map<String, ToolParameter> parameters,
        boolean readOnly
) {}
