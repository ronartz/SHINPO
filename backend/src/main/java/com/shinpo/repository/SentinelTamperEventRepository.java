package com.shinpo.repository;

import com.shinpo.entity.SentinelTamperEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SentinelTamperEventRepository extends JpaRepository<SentinelTamperEvent, Long> {

    long countByUser_Id(Long userId);

    List<SentinelTamperEvent> findTop20ByUser_IdOrderByCreatedAtDesc(Long userId);

    List<SentinelTamperEvent> findTop20ByUser_IdAndFocusSession_IdOrderByCreatedAtDesc(Long userId, Long focusSessionId);

    long countByUser_IdAndFocusSession_Id(Long userId, Long focusSessionId);
}
