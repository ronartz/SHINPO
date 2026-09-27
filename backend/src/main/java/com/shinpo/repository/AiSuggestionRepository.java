package com.shinpo.repository;

import com.shinpo.entity.AiSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AiSuggestionRepository extends JpaRepository<AiSuggestion, Long> {
    List<AiSuggestion> findAllByUser_IdOrderByCreatedAtDesc(Long userId);
}