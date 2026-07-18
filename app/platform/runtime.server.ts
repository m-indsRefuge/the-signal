export function readRequiredBinding(bindingName: string, value: string | undefined): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`Missing required Cloudflare binding: ${bindingName}`);
  }

  return normalizedValue;
}
