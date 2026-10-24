package com.shinpo.repository;

import com.shinpo.entity.ProgressEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProgressEventRepository
        extends JpaRepository<ProgressEvent, Long> {

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM ProgressEvent p
            WHERE p.user.id = :userId
            """)
    Integer getTotalProgressByUserId(@Param("userId") Long userId);

    List<ProgressEvent> findTop10ByUser_IdOrderByCreatedAtDesc(Long userId);

    boolean existsByUser_IdAndEventType(Long userId, String eventType);

    @Modifying
    @Query(value = """
            INSERT INTO progress_events (user_id, goal_id, event_type, amount, created_at)
            VALUES (:userId, :goalId, 'GOAL_COMPLETED', :amount, CURRENT_TIMESTAMP)
            ON CONFLICT (goal_id)
                WHERE event_type = 'GOAL_COMPLETED' AND goal_id IS NOT NULL
            DO NOTHING
            """, nativeQuery = true)
    int insertGoalCompletionReward(
            @Param("userId") Long userId,
            @Param("goalId") Long goalId,
            @Param("amount") Integer amount
    );

    @Query(value = """
            SELECT EXISTS (
                SELECT 1
                FROM users u
                JOIN user_onboarding o ON o.user_id = u.id AND o.status = 'COMPLETED'
                    AND o.started_at IS NOT NULL
                JOIN goals g ON g.user_id = u.id AND g.created_at > o.started_at
                JOIN missions m ON m.goal_id = g.id AND m.created_at > o.started_at
                JOIN focus_sessions s ON s.user_id = u.id AND s.mission_id = m.id
                    AND s.goal_id = g.id AND s.scheduled_at IS NOT NULL
                    AND s.created_at > m.created_at AND s.status = 'COMPLETED'
                    AND s.started_at IS NOT NULL AND s.ended_at IS NOT NULL
                JOIN mission_completions mc ON mc.mission_id = m.id
                    AND mc.completed_at BETWEEN s.started_at AND s.ended_at + INTERVAL '30 seconds'
                JOIN progress_events task_event ON task_event.mission_completion_id = mc.id
                    AND task_event.user_id = u.id AND task_event.event_type = 'MISSION_COMPLETED'
                WHERE u.id = :userId
                  AND m.status = 'COMPLETED'
                  AND EXISTS (
                      SELECT 1 FROM progress_events focus_event
                      WHERE focus_event.user_id = u.id
                        AND focus_event.event_type = 'FOCUS_SESSION_COMPLETED'
                        AND focus_event.created_at BETWEEN s.started_at AND s.ended_at + INTERVAL '30 seconds'
                  )
            )
            """, nativeQuery = true)
    boolean hasQualifyingOnboardingWorkflow(@Param("userId") Long userId);
}
