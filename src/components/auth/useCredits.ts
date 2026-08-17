"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/lib/firebase";

export function useCredits(): number | null {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    return onSnapshot(doc(db, "users", user.uid), (snap) => {
      setCredits((snap.data()?.credits as number) ?? 0);
    });
  }, [user]);

  return user ? credits : null;
}
