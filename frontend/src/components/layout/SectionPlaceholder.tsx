type SectionPlaceholderProps = {
  title: string
  description: string
}

export function SectionPlaceholder({
  title,
  description,
}: SectionPlaceholderProps) {
  return (
    <section aria-labelledby="section-placeholder-title" className="section-placeholder">
      <div aria-hidden="true" className="section-placeholder-icon">
        <i className="bi bi-compass" />
      </div>
      <div>
        <h2 className="section-placeholder-title" id="section-placeholder-title">
          {title}
        </h2>
        <p className="section-placeholder-description">{description}</p>
      </div>
    </section>
  )
}
