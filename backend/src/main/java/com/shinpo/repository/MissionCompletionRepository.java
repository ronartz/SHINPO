package com.shinpo.repository;

import com.shinpo.entity.MissionCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MissionCompletionRepository
        extends JpaRepository<MissionCompletion, Long> {
}