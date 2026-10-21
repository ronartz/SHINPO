package com.shinpo.repository;

import com.shinpo.entity.ProgressEvent;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
