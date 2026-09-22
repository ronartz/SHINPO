package com.shinpo.service;

import com.shinpo.dto.ProgressResponse;
import com.shinpo.repository.ProgressEventRepository;
import org.springframework.stereotype.Service;

@Service
public class ProgressService {

    private final ProgressEventRepository progressEventRepository;

    public ProgressService(
            ProgressEventRepository progressEventRepository
    ) {
        this.progressEventRepository = progressEventRepository;
    }

    public ProgressResponse getUserProgress(Long userId) {

        Integer totalProgress =
                progressEventRepository.getTotalProgressByUserId(userId);

        return new ProgressResponse(
                userId,
                totalProgress
        );
    }
}