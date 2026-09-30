package com.shinpo.repository;

import com.shinpo.entity.AiSuggestion;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiSuggestionRepository extends JpaRepository<AiSuggestion, Long> {
    List<AiSuggestion> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AiSuggestion> findByIdAndUser_Id(Long id, Long userId);
}