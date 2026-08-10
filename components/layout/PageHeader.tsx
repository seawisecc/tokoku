export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: React.ReactNode
  title: string
  subtitle?: React.ReactNode
}) {
  return (
    <div className="page-head">
      {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
    </div>
  )
}
