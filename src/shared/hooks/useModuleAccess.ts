export type ModuleId = 'exploration' | 'quiz' | 'navigation' | 'clinical-case';

export function useModuleAccess(moduleId: ModuleId): boolean {
  // TODO Fase 3/4: reemplazar por lectura real de authSlice.user.role
  return true;
}
