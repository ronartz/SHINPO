package com.shinpo.repository;

import com.shinpo.entity.ContextualFocusResource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ContextualFocusResourceRepository extends JpaRepository<ContextualFocusResource, Long> {

    Optional<ContextualFocusResource> findByIdAndUser_Id(Long id, Long userId);

    List<ContextualFocusResource> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

    List<ContextualFocusResource> findAllByUser_IdAndMission_IdOrderByCreatedAtDesc(Long userId, Long missionId);

    List<ContextualFocusResource> findAllByUser_IdAndFocusSession_IdOrderByCreatedAtDesc(Long userId, Long sessionId);

    @Query("""
        SELECT r FROM ContextualFocusResource r
        WHERE r.user.id = :userId
          AND r.enabled = true
          AND (r.focusSession.id = :sessionId OR (:missionId IS NOT NULL AND r.mission.id = :missionId))
          AND (r.expiresAt IS NULL OR r.expiresAt > :now)
        ORDER BY r.createdAt ASC
    """)
    List<ContextualFocusResource> findApplicableActiveResources(
            @Param("userId") Long userId,
            @Param("sessionId") Long sessionId,
            @Param("missionId") Long missionId,
            @Param("now") Instant now
    );
}
