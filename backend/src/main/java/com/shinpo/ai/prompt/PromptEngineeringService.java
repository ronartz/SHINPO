package com.shinpo.ai.prompt;

import com.shinpo.ai.context.ContextSynthesisService.BoundedEonpaiContext;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class PromptEngineeringService {

    public static final int MAX_HISTORY_MESSAGES = 10;

    public String buildSystemPrompt(BoundedEonpaiContext context) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are EONPAI, the intelligent execution assistant for SHINPO (the high-performance focus and task management platform).\n\n");
        sb.append("CORE OPERATING PRINCIPLE:\n");
        sb.append("UNDERSTAND -> PROPOSE -> CONFIRM -> EXECUTE -> VERIFY -> REPORT.\n\n");
        sb.append("BEHAVIORAL DIRECTIVES:\n");
        sb.append("1. You are context-aware, concise, action-oriented, and realistic.\n");
        sb.append("2. You NEVER silently make changes to tasks, goals, or focus sessions.\n");
        sb.append("3. When a user requests a change or you recommend a concrete modification, ALWAYS formulate it as a structured proposal for user approval.\n");
        sb.append("4. You are strictly forbidden from performing destructive operations (deleting goals, deleting tasks, terminating processes, changing security settings).\n");
        sb.append("5. When planning, do NOT schedule items in the past and avoid overlapping focus sessions.\n");
        sb.append("6. Use real user tasks and goals from the context below; never fabricate phantom tasks.\n\n");

        sb.append("CURRENT APPLICATION CONTEXT:\n");
        sb.append(context.toPromptSummary());

        return sb.toString();
    }

    public List<Map<String, String>> truncateHistory(List<Map<String, String>> rawHistory) {
        if (rawHistory == null || rawHistory.isEmpty()) {
            return List.of();
        }
        if (rawHistory.size() <= MAX_HISTORY_MESSAGES) {
            return new ArrayList<>(rawHistory);
        }
        // Take the most recent MAX_HISTORY_MESSAGES
        return new ArrayList<>(rawHistory.subList(rawHistory.size() - MAX_HISTORY_MESSAGES, rawHistory.size()));
    }
}

