package com.shinpo.repository;

import com.shinpo.entity.AiAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiActionRepository extends JpaRepository<AiAction, Long> {

    Optional<AiAction> findByActionId(String actionId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT a FROM AiAction a WHERE a.actionId = :actionId")
    Optional<AiAction> findByActionIdForUpdate(@org.springframework.data.repository.query.Param("actionId") String actionId);

    Optional<AiAction> findByActionIdAndUser_Id(String actionId, Long userId);

    List<AiAction> findAllByUser_IdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    List<AiAction> findTop10ByUser_IdOrderByCreatedAtDesc(Long userId);
}

