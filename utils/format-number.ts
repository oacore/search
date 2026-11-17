export const formatNumber = (
  number?: any,
  { locale = 'en-GB', maximumFractionDigits = 2, ...restOptions }: any = {}
) => {
  const numberConverted = new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    ...restOptions,
  }).format(number)
  if (numberConverted === 'NaN') return 'a lot of'
  return numberConverted
}
export default formatNumber
