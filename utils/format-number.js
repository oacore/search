export const formatNumber = (
  number,
  { locale = 'en-GB', maximumFractionDigits = 2, ...restOptions } = {}
) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    ...restOptions,
  }).format(number)

export default formatNumber
