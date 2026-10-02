package com.shinpo.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayDeque;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SentinelProcessTerminationVerificationTests {

    @Test
    void auditOnlyWarnsWithoutRequestingOrVerifyingTermination() {
        ProcessHandle handle = mock(ProcessHandle.class);

        assertEquals("WARNED", SentinelEnforcementService.enforceProcess(handle, "AUDIT_ONLY"));
        verifyNoInteractions(handle);
    }

    @Test
    void strictDoesNotReportTerminationWhenAcceptedRequestLeavesProcessAlive() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroyForcibly()).thenReturn(true);
        when(handle.onExit()).thenReturn(new CompletableFuture<>());
        when(handle.isAlive()).thenReturn(true);

        assertEquals("TERMINATE_ATTEMPTED", SentinelEnforcementService.enforceProcess(handle, "STRICT"));
        verify(handle).destroyForcibly();
    }

    @Test
    void strictReportsTerminatedOnlyAfterExitIsConfirmed() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroyForcibly()).thenReturn(true);
        when(handle.onExit()).thenReturn(CompletableFuture.completedFuture(handle));

        assertEquals("TERMINATED", SentinelEnforcementService.enforceProcess(handle, "STRICT"));
        verify(handle).destroyForcibly();
    }

    @Test
    void alreadyExitedProcessIsConfirmedEvenWhenTerminationRequestReturnsFalse() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroyForcibly()).thenReturn(false);
        when(handle.onExit()).thenReturn(CompletableFuture.completedFuture(handle));

        assertEquals("TERMINATED", SentinelEnforcementService.enforceProcess(handle, "STRICT"));
    }

    @Test
    void containmentEscalatesAndReportsContainedAfterForcedExit() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroy()).thenReturn(true);
        when(handle.destroyForcibly()).thenReturn(true);
        Queue<CompletableFuture<ProcessHandle>> exitFutures = new ArrayDeque<>(List.of(
            new CompletableFuture<>(),
            CompletableFuture.completedFuture(handle)
        ));
        when(handle.onExit()).thenAnswer(invocation -> exitFutures.remove());
        when(handle.isAlive()).thenReturn(true);

        assertEquals("CONTAINED", SentinelEnforcementService.enforceProcess(handle, "CONTAINMENT"));
        verify(handle).destroy();
        verify(handle).destroyForcibly();
    }

    @Test
    void containmentStopsAfterConfirmedGracefulExit() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroy()).thenReturn(true);
        when(handle.onExit()).thenReturn(CompletableFuture.completedFuture(handle));

        assertEquals("CONTAINED", SentinelEnforcementService.enforceProcess(handle, "CONTAINMENT"));
        verify(handle).destroy();
        verify(handle, never()).destroyForcibly();
    }

    @Test
    void containmentFailureIsNotReportedAsConfirmedWhenProcessRemainsAlive() {
        ProcessHandle handle = mock(ProcessHandle.class);
        when(handle.destroy()).thenReturn(true);
        when(handle.destroyForcibly()).thenReturn(true);
        Queue<CompletableFuture<ProcessHandle>> exitFutures = new ArrayDeque<>(List.of(
            new CompletableFuture<>(),
            new CompletableFuture<>()
        ));
        when(handle.onExit()).thenAnswer(invocation -> exitFutures.remove());
        when(handle.isAlive()).thenReturn(true);

        assertEquals("CONTAINMENT_FAILED", SentinelEnforcementService.enforceProcess(handle, "CONTAINMENT"));
        verify(handle).destroy();
        verify(handle).destroyForcibly();
    }
}
