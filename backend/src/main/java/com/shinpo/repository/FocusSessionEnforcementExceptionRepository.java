package com.shinpo.repository;

import com.shinpo.entity.FocusSessionActivityType;
import com.shinpo.entity.FocusSessionEnforcementException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FocusSessionEnforcementExceptionRepository extends JpaRepository<FocusSessionEnforcementException, Long> {

    List<FocusSessionEnforcementException> findAllByFocusSession_IdOrderByCreatedAtDesc(Long focusSessionId);

    Optional<FocusSessionEnforcementException> findByIdAndFocusSession_Id(Long id, Long focusSessionId);

    boolean existsByFocusSession_IdAndActivityTypeAndActivityPatternIgnoreCase(
            Long focusSessionId,
            FocusSessionActivityType activityType,
            String activityPattern
    );

    @Query("""
        SELECT e FROM FocusSessionEnforcementException e
        JOIN e.focusSession s
        WHERE s.user.id = :userId
          AND s.status = com.shinpo.entity.FocusSessionStatus.ACTIVE
          AND e.activityType = :activityType
    """)
    List<FocusSessionEnforcementException> findAllActiveExceptionsForUser(
            @Param("userId") Long userId,
            @Param("activityType") FocusSessionActivityType activityType
    );
}
