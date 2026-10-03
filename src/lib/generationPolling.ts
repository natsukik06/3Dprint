// A single failed status check (network blip, gateway hiccup) used to mark the whole -- already
// paid for, still running -- 3D generation as failed. The pollers in PreviewPanel, DuoBuilder and
// PoseSetBuilder only give up after this many failures in a row.
export const MAX_CONSECUTIVE_POLL_FAILURES = 5;
