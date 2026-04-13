let counter = 0;

export function uid(): string {
  return `msg_${++counter}_${Date.now()}`;
}
