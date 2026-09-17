// The backend returns real DB DateTime values (full ISO timestamps) where the
// old mock data used plain "YYYY-MM-DD" strings — format them consistently
// wherever a date is displayed.
export const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}
