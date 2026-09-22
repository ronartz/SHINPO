package com.shinpo.repository;

import com.shinpo.entity.ProgressEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProgressEventRepository
        extends JpaRepository<ProgressEvent, Long> {

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM ProgressEvent p
            WHERE p.user.id = :userId
            """)
    Integer getTotalProgressByUserId(@Param("userId") Long userId);
}