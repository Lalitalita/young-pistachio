import { MobilePlaceholder } from "../Placeholder";
import type { MobileProps } from "../types";

export default function Mobile(p: MobileProps) {
  return <MobilePlaceholder {...p} step={2} />;
}
