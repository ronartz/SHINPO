package com.shinpo.ai.tool;

import java.util.Map;

/**
 * Functional contract for executable AI tools in SHINPO.
 * All implementations MUST enforce user isolation scoped exclusively to {@code authenticatedUserId}.
 */
public interface AiTool {

    /**
     * Unique programmatic name of the tool (e.g. "get_current_goal").
     */
    String getName();

    /**
     * Clear, descriptive summary of the tool's capabilities and intended use cases.
     */
    String getDescription();

    /**
     * Schema map of expected input parameters and validation rules.
     */
    Map<String, ToolParameter> getParameters();

    /**
     * Whether this tool is strictly read-only and free of side effects.
     */
    default boolean isReadOnly() {
        return true;
    }

    /**
     * Returns the formal tool definition for catalogs and schema registries.
     */
    default ToolDefinition getDefinition() {
        return new ToolDefinition(getName(), getDescription(), getParameters(), isReadOnly());
    }

    /**
     * Execute the tool with user ownership enforcement.
     *
     * @param authenticatedUserId The verified user ID derived strictly from security context.
     * @param parameters Input parameters provided by the caller or model.
     * @return Structured {@link ToolResult} with outcome or sanitized error.
     */
    ToolResult execute(Long authenticatedUserId, Map<String, Object> parameters);
}
