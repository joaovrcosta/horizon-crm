"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DailyGoalToday } from "@horizon/shared";
import { useToast } from "@/components/toast";
import { apiFetch, setDailyGoalHandler } from "@/lib/api-client";

type DailyGoalContextValue = {
  progress: DailyGoalToday | null;
  loading: boolean;
  refreshGoal: () => Promise<void>;
};

const emptyGoal: DailyGoalToday = {
  visible: false,
  target: 0,
  completed: 0,
  remaining: 0,
  reached: false,
};

const DailyGoalContext = createContext<DailyGoalContextValue | null>(null);

function formatGoalToast(
  goal: DailyGoalToday,
  previousCompleted: number,
): string | null {
  if (!goal.visible) return null;
  if (goal.completed <= previousCompleted) return null;

  if (goal.reached) {
    return "Meta diária alcançada! Parabéns!";
  }

  if (goal.remaining === 1) {
    return "Tarefa concluída! Falta 1 estrela para a meta de hoje.";
  }

  return `Tarefa concluída! Faltam ${goal.remaining} estrelas para a meta de hoje.`;
}

export function DailyGoalProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [progress, setProgress] = useState<DailyGoalToday | null>(null);
  const [loading, setLoading] = useState(true);
  const previousCompletedRef = useRef(0);

  const applyGoal = useCallback(
    (goal: DailyGoalToday, celebrate = false) => {
      const message =
        celebrate && goal.visible
          ? formatGoalToast(goal, previousCompletedRef.current)
          : null;

      previousCompletedRef.current = goal.visible ? goal.completed : 0;
      setProgress(goal);

      if (message) {
        toast.success(message);
      }
    },
    [toast],
  );

  const refreshGoal = useCallback(async () => {
    try {
      const goal = await apiFetch<DailyGoalToday>("/goals/me/today");
      applyGoal(goal);
    } catch {
      applyGoal(emptyGoal);
    } finally {
      setLoading(false);
    }
  }, [applyGoal]);

  useEffect(() => {
    void refreshGoal();
  }, [refreshGoal]);

  useEffect(() => {
    setDailyGoalHandler((goal) => applyGoal(goal, true));
    return () => setDailyGoalHandler(null);
  }, [applyGoal]);

  const value = useMemo(
    () => ({ progress, loading, refreshGoal }),
    [progress, loading, refreshGoal],
  );

  return (
    <DailyGoalContext.Provider value={value}>
      {children}
    </DailyGoalContext.Provider>
  );
}

export function useDailyGoal() {
  const ctx = useContext(DailyGoalContext);
  if (!ctx) {
    throw new Error("useDailyGoal must be used within DailyGoalProvider");
  }
  return ctx;
}

export function useDailyGoalOptional() {
  return useContext(DailyGoalContext);
}
