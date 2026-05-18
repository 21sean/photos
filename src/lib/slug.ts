/**
 * Convert an album title into its URL slug, e.g. "San Diego" becomes "san-diego".
 */
export function titleToSlug(title: string): string {
  return title.toLowerCase().split(' ').join('-');
}
