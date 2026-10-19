package com.shinpo.repository;

import com.shinpo.entity.ContextualPolicyAuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContextualPolicyAuditEventRepository extends JpaRepository<ContextualPolicyAuditEvent, Long> {
    List<ContextualPolicyAuditEvent> findAllByUser_IdOrderByCreatedAtDesc(Long userId);
    List<ContextualPolicyAuditEvent> findAllByFocusSession_IdOrderByPolicyRevisionAsc(Long sessionId);
}
