export function acceptsNewerVersion(current: number | null, incoming: number): boolean {
  return current === null || incoming > current;
}
