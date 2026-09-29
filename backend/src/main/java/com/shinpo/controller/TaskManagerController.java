package com.shinpo.controller;

import com.shinpo.dto.TaskManagerDtos.*;
import com.shinpo.security.UserPrincipal;
import com.shinpo.service.TaskManagerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/device")
public class TaskManagerController {

    private final TaskManagerService taskManagerService;

    public TaskManagerController(TaskManagerService taskManagerService) {
        this.taskManagerService = taskManagerService;
    }

    @GetMapping("/system-info")
    public ResponseEntity<DeviceSystemInfo> getSystemInfo(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(taskManagerService.getSystemInfo());
    }

    @GetMapping("/processes")
    public ResponseEntity<List<ProcessInfo>> getProcesses(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "policy", required = false) String policy
    ) {
        return ResponseEntity.ok(taskManagerService.getProcesses(search, policy));
    }

    @GetMapping("/snapshot")
    public ResponseEntity<ProcessSnapshot> getSnapshot(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "policy", required = false) String policy
    ) {
        DeviceSystemInfo sysInfo = taskManagerService.getSystemInfo();
        List<ProcessInfo> procs = taskManagerService.getProcesses(search, policy);
        return ResponseEntity.ok(new ProcessSnapshot(sysInfo, procs, Instant.now()));
    }

    @PostMapping("/processes/{pid}/terminate")
    public ResponseEntity<ProcessControlResult> terminateProcess(
            @PathVariable Long pid,
            @RequestParam(value = "force", defaultValue = "false") boolean force,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(taskManagerService.terminateProcess(pid, force));
    }
}
