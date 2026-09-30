package com.shinpo.ai.tool;

/**
 * Encapsulates the execution result of an AI tool invocation.
 * Enforces structured feedback with success status, tool identity, payload, and optional error message.
 */
public record ToolResult(
        boolean success,
        String toolName,
        Object data,
        String errorMessage
) {
    public static ToolResult ok(String toolName, Object data) {
        return new ToolResult(true, toolName, data, null);
    }

    public static ToolResult error(String toolName, String errorMessage) {
        return new ToolResult(false, toolName, null, errorMessage);
    }
}
