"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobSnapshot = {
  status: JobStatus;
  progress: number;
  message: string | null;
  result: unknown;
  error: string | null;
};

/** Subscribes to a `jobs/{jobId}` doc. Returns an unsubscribe function. */
export function watchJob(jobId: string, onUpdate: (job: JobSnapshot) => void): () => void {
  return onSnapshot(doc(db, "jobs", jobId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    onUpdate({
      status: (data.status as JobStatus) ?? "queued",
      progress: typeof data.progress === "number" ? data.progress : 0,
      message: data.message ?? null,
      result: data.result ?? null,
      error: data.error ?? null,
    });
  });
}

/** Watches a job until it completes or fails, resolving/rejecting accordingly. */
export function waitForJob(
  jobId: string,
  onProgress?: (job: JobSnapshot) => void
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const unsubscribe = watchJob(jobId, (job) => {
      onProgress?.(job);
      if (job.status === "completed") {
        unsubscribe();
        resolve(job.result);
      } else if (job.status === "failed") {
        unsubscribe();
        reject(new Error(job.error ?? "処理に失敗しました"));
      }
    });
  });
}
