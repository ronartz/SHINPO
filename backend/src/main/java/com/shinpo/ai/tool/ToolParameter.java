package com.shinpo.ai.tool;

/**
 * Metadata descriptor for an AI tool input parameter.
 */
public record ToolParameter(
        String name,
        String type,
        String description,
        boolean required
) {}
