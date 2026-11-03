import {
  Code2,
  Palette,
  Gamepad2,
  FileText,
  Wrench,
  Music2,
  Folder,
  Star,
  Rocket,
  Globe,
  Archive,
  Heart,
} from 'lucide-react';
import {
  IconCode,
  IconPalette,
  IconDeviceGamepad2,
  IconFileText,
  IconTool,
  IconMusic,
  IconFolder,
  IconStar,
  IconRocket,
  IconWorld,
  IconArchive,
  IconHeart,
} from '@tabler/icons-react';
import { usePreferences } from '../preferences';
const lucide = {
  code: Code2,
  palette: Palette,
  gamepad: Gamepad2,
  file: FileText,
  wrench: Wrench,
  music: Music2,
  folder: Folder,
  star: Star,
  rocket: Rocket,
  globe: Globe,
  archive: Archive,
  heart: Heart,
};
const tabler = {
  code: IconCode,
  palette: IconPalette,
  gamepad: IconDeviceGamepad2,
  file: IconFileText,
  wrench: IconTool,
  music: IconMusic,
  folder: IconFolder,
  star: IconStar,
  rocket: IconRocket,
  globe: IconWorld,
  archive: IconArchive,
  heart: IconHeart,
};
import minimal from '../../shared/minimal-icons.json';
export default function AppIcon({ name = 'folder', size = 22, pack, ...props }) {
  const { settings } = usePreferences();
  const selected = pack || settings.iconPack;
  if (selected === 'duotone')
    return (
      <svg
        data-icon-pack="duotone"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <rect
          x="1"
          y="1"
          width="22"
          height="22"
          rx="7"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="none"
        />
        <path d={minimal[name] || minimal.folder} fill="currentColor" fillOpacity="0.18" />
      </svg>
    );
  if (selected === 'rounded') {
    const Icon = tabler[name] || IconFolder;
    return (
      <Icon
        data-icon-pack="rounded"
        size={size}
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      />
    );
  }
  if (selected === 'minimal')
    return (
      <svg
        data-icon-pack="minimal"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="miter"
        {...props}
      >
        <path d={minimal[name] || minimal.folder} />
      </svg>
    );
  const Icon = (selected === 'tabler' ? tabler : lucide)[name] || Folder;
  return <Icon data-icon-pack={selected} size={size} strokeWidth={1.7} {...props} />;
}
