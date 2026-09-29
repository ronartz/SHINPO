package com.shinpo.dto;

import java.time.Instant;
import java.util.List;

public class TaskManagerDtos {

    public record ProcessInfo(
            Long pid,
            String name,
            String executablePath,
            Double cpuPercent,
            Long memoryBytes,
            String status,
            Instant startedAt,
            String user,
            String shinpoPolicyState, // ALLOWED, BLOCKED, PROTECTED, UNKNOWN
            String policyReason,
            boolean canControl
    ) {}

    public record ProcessControlRequest(
            Long pid,
            String processName,
            boolean force
    ) {}

    public record ProcessControlResult(
            Long pid,
            String action,
            String status,
            String message
    ) {}

    public record DeviceSystemInfo(
            String deviceName,
            String osName,
            String osVersion,
            String osArch,
            Integer availableProcessors,
            Double systemCpuLoad,
            Long totalMemoryBytes,
            Long freeMemoryBytes,
            Integer processCount
    ) {}

    public record ProcessSnapshot(
            DeviceSystemInfo systemInfo,
            List<ProcessInfo> processes,
            Instant timestamp
    ) {}
}
