package com.shinpo.dto;

public record ProgressResponse(
        Long userId,
        Integer totalProgress
) {
}
