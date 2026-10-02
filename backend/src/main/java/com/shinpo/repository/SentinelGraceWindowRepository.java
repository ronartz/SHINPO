package com.shinpo.repository;

import com.shinpo.entity.SentinelGraceStatus;
import com.shinpo.entity.SentinelGraceWindow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SentinelGraceWindowRepository extends JpaRepository<SentinelGraceWindow, Long> {

    Optional<SentinelGraceWindow> findByWarningIdAndUser_Id(UUID warningId, Long userId);

    Optional<SentinelGraceWindow> findByWarningId(UUID warningId);

    Optional<SentinelGraceWindow> findByFocusSession_IdAndProcessNameAndStatus(
            Long focusSessionId,
            String processName,
            SentinelGraceStatus status
    );

    boolean existsByFocusSession_IdAndProcessNameAndStatusIn(
            Long focusSessionId,
            String processName,
            Collection<SentinelGraceStatus> statuses
    );

    List<SentinelGraceWindow> findAllByUser_IdAndFocusSession_IdAndStatus(
            Long userId,
            Long focusSessionId,
            SentinelGraceStatus status
    );

    List<SentinelGraceWindow> findAllByFocusSession_IdAndStatus(Long focusSessionId, SentinelGraceStatus status);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE SentinelGraceWindow g SET g.status = :newStatus, g.updatedAt = :now " +
           "WHERE g.status = 'ACTIVE' AND g.expiresAt <= :now")
    int expireStaleGraceWindows(
            @Param("newStatus") SentinelGraceStatus newStatus,
            @Param("now") Instant now
    );
}
