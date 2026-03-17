export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return '₹0.00'
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount)
}

export const formatNumber = (number) => {
  if (number === null || number === undefined) return '0'
  return new Intl.NumberFormat('en-IN').format(number)
}

export const formatDate = (date, format = 'dd MMM yyyy') => {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const day = String(d.getDate()).padStart(2, '0')
  const month = d.toLocaleString('en-IN', { month: 'short' })
  const year = d.getFullYear()
  
  return `${day} ${month} ${year}`
}

export const formatDateTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export const maskAadhar = (aadhar) => {
  if (!aadhar || aadhar.length !== 12) return aadhar
  return `XXXX-XXXX-${aadhar.slice(-4)}`
}

export const maskBankAccount = (account) => {
  if (!account || account.length < 4) return account
  return `XXXX${account.slice(-4)}`
}

export const capitalizeFirst = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export const formatName = (firstName, middleName, lastName) => {
  const parts = [firstName, middleName, lastName].filter(Boolean)
  return parts.join(' ')
}
