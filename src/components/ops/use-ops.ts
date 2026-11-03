import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { injectScenario, saveOpsSettings, syncOps } from "@/lib/sva/api";
import type { AppSettings } from "@/lib/sva/types";

export function useOps() {
  return useQuery({
    queryKey: ["ops"],
    queryFn: () => syncOps(),
    refetchInterval: 2000,
  });
}

export function useInjectScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cameraId?: string) => injectScenario({ data: { cameraId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops"] }),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => saveOpsSettings({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops"] }),
  });
}
