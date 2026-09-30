package com.shinpo.repository;

import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Collection;

public interface FocusSessionRepository extends JpaRepository<FocusSession, Long> {

    List<FocusSession> findAllByUser_IdOrderByCreatedAtDesc(Long userId);

    Optional<FocusSession> findFirstByUser_IdAndStatusOrderByCreatedAtDesc(Long userId, FocusSessionStatus status);

    Optional<FocusSession> findFirstByUser_IdOrderByCreatedAtDesc(Long userId);

    Optional<FocusSession> findByIdAndUser_Id(Long id, Long userId);

    boolean existsByUser_IdAndStatusIn(Long userId, Collection<FocusSessionStatus> statuses);

    @Query("""
        SELECT s FROM FocusSession s
        WHERE s.user.id = :userId
          AND (
              (s.scheduledAt >= :start AND s.scheduledAt < :end)
              OR (s.scheduledAt IS NULL AND s.startedAt >= :start AND s.startedAt < :end)
              OR (s.scheduledAt IS NULL AND s.startedAt IS NULL AND s.createdAt >= :start AND s.createdAt < :end)
          )
        ORDER BY COALESCE(s.scheduledAt, s.startedAt, s.createdAt) ASC
    """)
    List<FocusSession> findSessionsForUserBetween(
            @Param("userId") Long userId,
            @Param("start") Instant start,
            @Param("end") Instant end
    );
}