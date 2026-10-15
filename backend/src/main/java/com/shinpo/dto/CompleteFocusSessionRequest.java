package com.shinpo.dto;

public record CompleteFocusSessionRequest(
    Integer quality,
    String reflectionNote,
    String accomplishment,
    Boolean markMissionCompleted
) {
    public CompleteFocusSessionRequest(Integer quality, String reflectionNote, String accomplishment) {
        this(quality, reflectionNote, accomplishment, false);
    }
}