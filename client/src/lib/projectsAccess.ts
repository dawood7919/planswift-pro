export type ProjectsAccessState = "auth-loading" | "guest" | "authenticated";

export function getProjectsAccessState({
  isAuthLoading,
  userId,
}: {
  isAuthLoading: boolean;
  userId?: string | number | null;
}): ProjectsAccessState {
  if (isAuthLoading) return "auth-loading";
  return userId ? "authenticated" : "guest";
}

export function canLoadProjects(state: ProjectsAccessState): boolean {
  return state === "authenticated";
}
