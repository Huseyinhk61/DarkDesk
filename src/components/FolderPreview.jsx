import { folderSvg, resolveFolderTheme } from '../../shared/folder-appearance';
import { usePreferences } from '../preferences';

export default function FolderPreview({ category, size = 48, theme }) {
  const { settings } = usePreferences();
  const svg = folderSvg({
    color: category?.color || 'purple',
    theme: theme || resolveFolderTheme(category, settings.folderTheme),
    icon: category?.icon || 'folder',
    customColor: category?.customColor,
  });
  return (
    <img
      className="folder-preview"
      src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable="false"
    />
  );
}
