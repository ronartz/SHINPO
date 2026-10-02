package com.shinpo.repository;

import com.shinpo.entity.SentinelEnforcementWarning;
import com.shinpo.entity.SentinelWarningStatus;
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
public interface SentinelEnforcementWarningRepository extends JpaRepository<SentinelEnforcementWarning, Long> {

    Optional<SentinelEnforcementWarning> findByWarningIdAndUser_Id(UUID warningId, Long userId);

    Optional<SentinelEnforcementWarning> findByWarningId(UUID warningId);

    List<SentinelEnforcementWarning> findAllByUser_IdAndStatusInOrderByIssuedAtDesc(
            Long userId,
            Collection<SentinelWarningStatus> statuses
    );

    Optional<SentinelEnforcementWarning> findByFocusSession_IdAndProcessNameAndStatusIn(
            Long focusSessionId,
            String processName,
            Collection<SentinelWarningStatus> statuses
    );

    boolean existsByFocusSession_IdAndProcessNameAndStatusIn(
            Long focusSessionId,
            String processName,
            Collection<SentinelWarningStatus> statuses
    );

    List<SentinelEnforcementWarning> findAllByFocusSession_IdAndStatus(Long focusSessionId, SentinelWarningStatus status);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE SentinelEnforcementWarning w SET w.status = :newStatus, w.updatedAt = :now " +
           "WHERE w.status = 'ISSUED' AND w.decisionDeadline <= :now")
    int expireStaleWarnings(
            @Param("newStatus") SentinelWarningStatus newStatus,
            @Param("now") Instant now
    );

    @Modifying(clearAutomatically = true)
    @Query("UPDATE SentinelEnforcementWarning w SET w.status = :newStatus, w.updatedAt = :now " +
           "WHERE w.status = 'GRACE_ACTIVE' AND w.warningId IN (" +
           "  SELECT g.warningId FROM SentinelGraceWindow g WHERE g.expiresAt <= :now OR g.status = :consumedStatus" +
           ")")
    int expireGraceActiveWarnings(
            @Param("newStatus") SentinelWarningStatus newStatus,
            @Param("consumedStatus") com.shinpo.entity.SentinelGraceStatus consumedStatus,
            @Param("now") Instant now
    );
}
