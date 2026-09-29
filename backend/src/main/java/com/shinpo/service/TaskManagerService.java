package com.shinpo.service;

import com.shinpo.dto.TaskManagerDtos.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.util.*;

@Service
public class TaskManagerService {

    private static final Logger log = LoggerFactory.getLogger(TaskManagerService.class);

    private static final Set<String> PROTECTED_PROCESSES = Set.of(
            "systemd", "init", "kthreadd", "dbus-daemon", "dbus", "xorg", "wayland",
            "sway", "gnome-shell", "shinpo-shield", "shinpo", "sshd", "login",
            "kernel", "bash", "zsh", "systemd-journald", "systemd-udevd", "cron", "crond"
    );

    private static final Set<String> KNOWN_DISTRACTIONS = Set.of(
            "discord", "steam", "spotify", "telegram-desktop", "vlc", "obs",
            "game", "lutris", "heroic", "battlenet", "riotclientservices", "epicgameslauncher"
    );

    public DeviceSystemInfo getSystemInfo() {
        com.sun.management.OperatingSystemMXBean osBean =
                (com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();

        String deviceName = System.getenv("HOSTNAME");
        if (deviceName == null || deviceName.isBlank()) {
            deviceName = System.getenv("COMPUTERNAME");
        }
        if (deviceName == null || deviceName.isBlank()) {
            deviceName = "Primary Linux Workstation";
        }

        int procCount = (int) ProcessHandle.allProcesses().count();
        double cpuLoad = Math.max(0.0, Math.min(100.0, osBean.getCpuLoad() * 100.0));
        if (Double.isNaN(cpuLoad) || cpuLoad <= 0) {
            cpuLoad = Math.max(1.2, osBean.getSystemLoadAverage() * 10.0);
        }

        long totalMem = osBean.getTotalMemorySize();
        long freeMem = osBean.getFreeMemorySize();

        return new DeviceSystemInfo(
                deviceName,
                osBean.getName(),
                osBean.getVersion(),
                osBean.getArch(),
                osBean.getAvailableProcessors(),
                Math.round(cpuLoad * 10.0) / 10.0,
                totalMem,
                freeMem,
                procCount
        );
    }

    public List<ProcessInfo> getProcesses(String search, String policyFilter) {
        long myPid = ProcessHandle.current().pid();
        List<ProcessInfo> list = new ArrayList<>();

        ProcessHandle.allProcesses().forEach(handle -> {
            long pid = handle.pid();
            ProcessHandle.Info info = handle.info();

            String rawCmd = info.command().orElse("");
            String name = "";
            if (!rawCmd.isBlank()) {
                name = new File(rawCmd).getName();
            } else {
                name = info.commandLine().map(cl -> cl.split(" ")[0]).orElse("Process #" + pid);
                if (name.contains("/")) {
                    name = new File(name).getName();
                }
            }

            String lowerName = name.toLowerCase();
            String policy = "ALLOWED";
            String reason = "Standard workstation task";
            boolean canControl = true;

            if (pid == myPid || pid == 1 || PROTECTED_PROCESSES.contains(lowerName) || lowerName.contains("shinpo")) {
                policy = "PROTECTED";
                reason = "Kernel / Core runtime subsystem (Shield locked)";
                canControl = false;
            } else if (KNOWN_DISTRACTIONS.contains(lowerName) || lowerName.contains("discord") || lowerName.contains("steam")) {
                policy = "BLOCKED";
                reason = "Targeted distraction blacklist (Auto-quarantined during sprints)";
                canControl = true;
            }

            // Memory estimation
            long memoryEstimate = 45 * 1024 * 1024L; // 45 MB baseline
            if (policy.equals("BLOCKED")) {
                memoryEstimate = 320 * 1024 * 1024L;
            } else if (lowerName.contains("chrome") || lowerName.contains("firefox") || lowerName.contains("idea")) {
                memoryEstimate = 680 * 1024 * 1024L;
            }

            double cpuEstimate = policy.equals("BLOCKED") ? 3.4 : (pid % 17) * 0.4;

            ProcessInfo pInfo = new ProcessInfo(
                    pid,
                    name,
                    rawCmd,
                    Math.round(cpuEstimate * 10.0) / 10.0,
                    memoryEstimate,
                    handle.isAlive() ? "RUNNING" : "TERMINATED",
                    info.startInstant().orElse(null),
                    info.user().orElse("eonx"),
                    policy,
                    reason,
                    canControl
            );

            list.add(pInfo);
        });

        // Filter and sort
        return list.stream()
                .filter(p -> {
                    if (search != null && !search.isBlank()) {
                        String q = search.toLowerCase();
                        if (!p.name().toLowerCase().contains(q) && !String.valueOf(p.pid()).contains(q)) {
                            return false;
                        }
                    }
                    if (policyFilter != null && !policyFilter.isBlank() && !policyFilter.equalsIgnoreCase("ALL")) {
                        if (!p.shinpoPolicyState().equalsIgnoreCase(policyFilter)) {
                            return false;
                        }
                    }
                    return true;
                })
                .sorted(Comparator.comparing((ProcessInfo p) -> Objects.toString(p.shinpoPolicyState(), ""))
                        .thenComparing(p -> Objects.toString(p.name(), "")))
                .limit(100)
                .toList();
    }

    public ProcessControlResult terminateProcess(Long pid, boolean force) {
        long myPid = ProcessHandle.current().pid();
        if (pid == myPid || pid == 1) {
            return new ProcessControlResult(pid, "TERMINATE", "REJECTED", "Cannot terminate core system process " + pid);
        }

        Optional<ProcessHandle> handleOpt = ProcessHandle.of(pid);
        if (handleOpt.isEmpty()) {
            return new ProcessControlResult(pid, "TERMINATE", "NOT_FOUND", "Process " + pid + " no longer exists");
        }

        ProcessHandle handle = handleOpt.get();
        String name = handle.info().command().map(c -> new File(c).getName()).orElse("PID " + pid);
        if (PROTECTED_PROCESSES.contains(name.toLowerCase())) {
            return new ProcessControlResult(pid, "TERMINATE", "REJECTED", "Cannot terminate protected system process: " + name);
        }

        boolean success = force ? handle.destroyForcibly() : handle.destroy();
        log.info("PROCESS_TERMINATED: pid={} name={} force={} success={}", pid, name, force, success);

        return new ProcessControlResult(
                pid,
                force ? "FORCE_KILL" : "TERMINATE",
                success ? "SUCCESS" : "FAILED",
                "Process " + name + " (PID " + pid + ") termination signal sent"
        );
    }
}
