export const formatNumber = (
  number,
  { locale = 'en-GB', maximumFractionDigits = 2, ...restOptions } = {}
) => {
  const numberConverted = new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    ...restOptions,
  }).format(number)
  if (numberConverted === 'NaN') return 'a lot of'
  return numberConverted
}
export default formatNumber
