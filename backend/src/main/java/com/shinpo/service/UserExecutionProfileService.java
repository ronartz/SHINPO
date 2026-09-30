package com.shinpo.service;

import com.shinpo.dto.AiDtos.UserExecutionProfileDto;
import com.shinpo.entity.FocusSession;
import com.shinpo.entity.FocusSessionStatus;
import com.shinpo.entity.Mission;
import com.shinpo.repository.FocusSessionRepository;
import com.shinpo.repository.MissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class UserExecutionProfileService {

    public static final int MIN_SESSIONS_THRESHOLD = 3;

    private final FocusSessionRepository focusSessionRepository;
    private final MissionRepository missionRepository;

    public UserExecutionProfileService(
            FocusSessionRepository focusSessionRepository,
            MissionRepository missionRepository
    ) {
        this.focusSessionRepository = focusSessionRepository;
        this.missionRepository = missionRepository;
    }

    public UserExecutionProfileDto getUserExecutionProfile(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID is required to calculate execution profile");
        }

        List<FocusSession> allSessions = focusSessionRepository.findAllByUser_IdOrderByCreatedAtDesc(userId);
        List<FocusSession> completedSessions = allSessions.stream()
                .filter(s -> s.getStatus() == FocusSessionStatus.COMPLETED)
                .toList();

        List<Mission> allMissions = missionRepository.findAllByGoal_User_Id(userId);
        int completedMissions = (int) allMissions.stream()
                .filter(m -> "COMPLETED".equalsIgnoreCase(m.getStatus()))
                .count();

        int sessionCount = completedSessions.size();

        // 1. STRICT TRUTHFULNESS: Check statistical threshold
        if (sessionCount < MIN_SESSIONS_THRESHOLD) {
            long totalFocusMins = 0;
            for (FocusSession s : completedSessions) {
                Instant end = s.getEndedAt() != null ? s.getEndedAt() : (s.getUpdatedAt() != null ? s.getUpdatedAt() : Instant.now());
                totalFocusMins += Math.round(s.calculateActiveSeconds(end) / 60.0);
            }

            return new UserExecutionProfileDto(
                    userId,
                    false,
                    sessionCount,
                    completedMissions,
                    totalFocusMins,
                    null,
                    null,
                    "INSUFFICIENT_DATA",
                    "NONE",
                    null,
                    String.format("Insufficient historical data: %d completed focus sessions required to calibrate personal execution profile (currently %d/%d). No estimations fabricated.",
                            MIN_SESSIONS_THRESHOLD, sessionCount, MIN_SESSIONS_THRESHOLD)
            );
        }

        // 2. CALIBRATION FROM REAL DATA
        double totalActiveMinutes = 0.0;
        double totalBiasPercentage = 0.0;
        Instant earliest = null;
        Instant latest = null;

        for (FocusSession s : completedSessions) {
            Instant end = s.getEndedAt() != null ? s.getEndedAt() : (s.getUpdatedAt() != null ? s.getUpdatedAt() : Instant.now());
            Instant start = s.getStartedAt() != null ? s.getStartedAt() : s.getCreatedAt();
            if (earliest == null || (start != null && start.isBefore(earliest))) {
                earliest = start;
            }
            if (latest == null || (end != null && end.isAfter(latest))) {
                latest = end;
            }

            long activeSecs = s.calculateActiveSeconds(end);
            double activeMins = activeSecs / 60.0;
            totalActiveMinutes += activeMins;

            int plannedMins = (s.getDurationMinutes() != null && s.getDurationMinutes() > 0)
                    ? s.getDurationMinutes()
                    : 25;

            double sessionBias = ((activeMins - plannedMins) / (double) plannedMins) * 100.0;
            totalBiasPercentage += sessionBias;
        }

        double avgFocusMinutes = Math.round((totalActiveMinutes / sessionCount) * 10.0) / 10.0;
        double avgBiasPercentage = Math.round((totalBiasPercentage / sessionCount) * 10.0) / 10.0;
        long totalMinutes = Math.round(totalActiveMinutes);

        String category;
        if (avgBiasPercentage > 15.0) {
            category = "UNDERESTIMATING";
        } else if (avgBiasPercentage < -15.0) {
            category = "OVERESTIMATING";
        } else {
            category = "ON_TRACK";
        }

        String confidence;
        if (sessionCount > 15) {
            confidence = "HIGH";
        } else if (sessionCount >= 6) {
            confidence = "MEDIUM";
        } else {
            confidence = "LOW";
        }

        long daysSpan = 1;
        if (earliest != null && latest != null && !latest.isBefore(earliest)) {
            daysSpan = Math.max(1, Duration.between(earliest, latest).toDays() + 1);
        }
        double velocity = Math.round(((double) sessionCount / daysSpan) * 100.0) / 100.0;

        String statusMsg = String.format("Calibrated on %d completed sessions. Average sprint: %.1fm. Estimation bias: %+.1f%% (%s). Confidence: %s.",
                sessionCount, avgFocusMinutes, avgBiasPercentage, category, confidence);

        return new UserExecutionProfileDto(
                userId,
                true,
                sessionCount,
                completedMissions,
                totalMinutes,
                avgFocusMinutes,
                avgBiasPercentage,
                category,
                confidence,
                velocity,
                statusMsg
        );
    }

    public Map<String, Object> getUserExecutionProfileMap(Long userId) {
        UserExecutionProfileDto dto = getUserExecutionProfile(userId);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("userId", dto.userId());
        map.put("hasSufficientData", dto.hasSufficientData());
        map.put("completedSessionsCount", dto.completedSessionsCount());
        map.put("totalMissionsCompleted", dto.totalMissionsCompleted());
        map.put("totalFocusMinutes", dto.totalFocusMinutes());
        map.put("averageFocusMinutes", dto.averageFocusMinutes());
        map.put("estimationBiasPercentage", dto.estimationBiasPercentage());
        map.put("estimationAccuracyCategory", dto.estimationAccuracyCategory());
        map.put("confidenceLevel", dto.confidenceLevel());
        map.put("completionVelocityPerDay", dto.completionVelocityPerDay());
        map.put("statusMessage", dto.statusMessage());
        return map;
    }
}
