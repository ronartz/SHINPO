package com.shinpo.service;

import com.shinpo.dto.FocusSessionExceptionDtos.CreateFocusSessionExceptionRequest;
import com.shinpo.dto.FocusSessionExceptionDtos.FocusSessionExceptionResponse;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionActivityType;
import com.shinpo.entity.FocusSessionEnforcementException;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.repository.FocusSessionEnforcementExceptionRepository;
import com.shinpo.repository.FocusSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FocusSessionEnforcementExceptionService {

    private final FocusSessionEnforcementExceptionRepository exceptionRepository;
    private final FocusSessionRepository focusSessionRepository;

    public FocusSessionEnforcementExceptionService(
            FocusSessionEnforcementExceptionRepository exceptionRepository,
            FocusSessionRepository focusSessionRepository
    ) {
        this.exceptionRepository = exceptionRepository;
        this.focusSessionRepository = focusSessionRepository;
    }

    @Transactional
    public FocusSessionExceptionResponse createException(
            Long userId,
            Long sessionId,
            CreateFocusSessionExceptionRequest request
    ) {
        FocusSession session = getSessionAndVerifyOwnership(sessionId, userId);

        if (request == null || request.activityPattern() == null || request.activityPattern().isBlank()) {
            throw new IllegalArgumentException("Activity pattern cannot be blank");
        }

        String pattern = request.activityPattern().trim().toLowerCase();
        FocusSessionActivityType type = request.activityType() != null
                ? request.activityType()
                : FocusSessionActivityType.PROCESS;

        if (exceptionRepository.existsByFocusSession_IdAndActivityTypeAndActivityPatternIgnoreCase(sessionId, type, pattern)) {
            throw new IllegalArgumentException("Exception already exists for this activity pattern in the session");
        }

        FocusSessionEnforcementException entity = new FocusSessionEnforcementException(
                session,
                pattern,
                type
        );

        FocusSessionEnforcementException saved = exceptionRepository.save(entity);
        return FocusSessionExceptionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<FocusSessionExceptionResponse> listExceptions(Long userId, Long sessionId) {
        // Ownership verification ensures user cannot inspect exceptions of sessions they do not own
        getSessionAndVerifyOwnership(sessionId, userId);

        return exceptionRepository.findAllByFocusSession_IdOrderByCreatedAtDesc(sessionId)
                .stream()
                .map(FocusSessionExceptionResponse::from)
                .toList();
    }

    @Transactional
    public void deleteException(Long userId, Long sessionId, Long exceptionId) {
        // Ownership verification ensures user cannot delete exceptions on sessions they do not own
        getSessionAndVerifyOwnership(sessionId, userId);

        FocusSessionEnforcementException exception = exceptionRepository
                .findByIdAndFocusSession_Id(exceptionId, sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Enforcement exception not found: " + exceptionId));

        exceptionRepository.delete(exception);
    }

    @Transactional(readOnly = true)
    public List<String> getActiveProcessExceptionsForUser(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return exceptionRepository.findAllActiveExceptionsForUser(userId, FocusSessionActivityType.PROCESS)
                .stream()
                .map(FocusSessionEnforcementException::getActivityPattern)
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isActivityPermittedByActiveSessionException(Long userId, String processName) {
        if (userId == null || processName == null || processName.isBlank()) {
            return false;
        }

        String target = processName.trim().toLowerCase();
        List<FocusSessionEnforcementException> activeExceptions =
                exceptionRepository.findAllActiveExceptionsForUser(userId, FocusSessionActivityType.PROCESS);

        return activeExceptions.stream().anyMatch(ex -> {
            String pattern = ex.getActivityPattern().toLowerCase();
            return target.contains(pattern) || pattern.contains(target);
        });
    }

    @Transactional(readOnly = true)
    public boolean isActivityPermittedForSession(Long sessionId, String processName) {
        if (sessionId == null || processName == null || processName.isBlank()) {
            return false;
        }

        FocusSession session = focusSessionRepository.findById(sessionId).orElse(null);
        if (session == null || session.getStatus() != FocusSessionStatus.ACTIVE) {
            return false;
        }

        String target = processName.trim().toLowerCase();
        List<FocusSessionEnforcementException> exceptions =
                exceptionRepository.findAllByFocusSession_IdOrderByCreatedAtDesc(sessionId);

        return exceptions.stream()
                .filter(ex -> ex.getActivityType() == FocusSessionActivityType.PROCESS)
                .anyMatch(ex -> {
                    String pattern = ex.getActivityPattern().toLowerCase();
                    return target.contains(pattern) || pattern.contains(target);
                });
    }

    private FocusSession getSessionAndVerifyOwnership(Long sessionId, Long userId) {
        return focusSessionRepository
                .findByIdAndUser_Id(sessionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Focus session not found: " + sessionId));
    }
}
