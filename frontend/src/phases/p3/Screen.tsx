import { ScreenPlaceholder } from "../Placeholder";
import type { ScreenProps } from "../types";

export default function Screen(p: ScreenProps) {
  return <ScreenPlaceholder {...p} step={4} />;
}
