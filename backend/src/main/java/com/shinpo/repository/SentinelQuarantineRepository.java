package com.shinpo.repository;

import com.shinpo.entity.SentinelQuarantineRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface SentinelQuarantineRepository extends JpaRepository<SentinelQuarantineRecord, Long> {

    List<SentinelQuarantineRecord> findAllByUser_IdOrderByDetectedAtDesc(Long userId);

    List<SentinelQuarantineRecord> findTop20ByUser_IdOrderByDetectedAtDesc(Long userId);

    List<SentinelQuarantineRecord> findAllByUser_IdAndFocusSession_IdOrderByDetectedAtDesc(Long userId, Long focusSessionId);

    long countByUser_IdAndFocusSession_Id(Long userId, Long focusSessionId);

    @Query("SELECT COUNT(s) FROM SentinelQuarantineRecord s WHERE s.user.id = :userId AND s.detectedAt >= :since")
    long countByUser_IdAndDetectedAtAfter(@Param("userId") Long userId, @Param("since") Instant since);
}
