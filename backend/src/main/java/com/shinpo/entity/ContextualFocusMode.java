package com.shinpo.entity;

/**
 * Browser-resource protection is deliberately separate from Sentinel's native
 * process enforcement mode (STRICT/AUDIT_ONLY/CONTAINMENT).
 */
public enum ContextualFocusMode {
    GUIDED,
    PROTECTED,
    STRICT
}
