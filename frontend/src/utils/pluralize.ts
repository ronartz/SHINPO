export function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${new Intl.PluralRules().select(value) === 'one' ? singular : plural}`
}
