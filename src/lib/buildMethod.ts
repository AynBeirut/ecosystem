export type BuildMethod = 'classic' | 'theme_editor' | 'wordpress' | 'import';

export const BUILD_METHOD_LABELS: Record<BuildMethod, string> = {
  classic: 'Classic Templates',
  theme_editor: 'Theme Editor',
  wordpress: 'WordPress',
  import: 'Import',
};

export function editorPathForBuildMethod(method: BuildMethod): string | null {
  if (method === 'classic') return '/admin/templates';
  if (method === 'theme_editor') return '/admin/theme-editor';
  return null;
}

export function buildMethodForPath(pathname: string): BuildMethod | null {
  if (pathname.startsWith('/admin/templates')) return 'classic';
  if (pathname.startsWith('/admin/theme-editor')) return 'theme_editor';
  return null;
}

export function isGrabioEditorMethod(method?: string | null): method is 'classic' | 'theme_editor' {
  return method === 'classic' || method === 'theme_editor';
}
