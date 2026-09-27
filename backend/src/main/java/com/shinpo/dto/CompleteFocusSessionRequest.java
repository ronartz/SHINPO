package com.shinpo.dto;

public record CompleteFocusSessionRequest(
    Integer quality,
    String reflectionNote,
    String accomplishment
) {}