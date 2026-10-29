/** Display-only labels; identifiers and API payloads remain untouched. */
export function displayName(name: string, fallback: string): string {
  const label = /CHECKOUT_VISUAL_TEST/i.test(name)
    ? name.replace(/^.*?CHECKOUT_VISUAL_TEST\S*\s*/i, "").trim()
    : name
  return label && !/CHECKOUT_VISUAL_TEST|^[a-f0-9-]{16,}$/i.test(label) ? label : fallback
}
