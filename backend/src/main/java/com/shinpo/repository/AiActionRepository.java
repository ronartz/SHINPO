package com.shinpo.repository;

import com.shinpo.entity.AiAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiActionRepository extends JpaRepository<AiAction, Long> {

    Optional<AiAction> findByActionId(String actionId);

    Optional<AiAction> findByActionIdAndUser_Id(String actionId, Long userId);

    List<AiAction> findAllByUser_IdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    List<AiAction> findTop10ByUser_IdOrderByCreatedAtDesc(Long userId);
}

