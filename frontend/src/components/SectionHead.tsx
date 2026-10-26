type Props = {
  label?: string
  title: string
  accent?: string
}

function SectionHead({ label, title, accent }: Props) {
  return (
    <div className="section-head">
      {label && <p className="label">{label}</p>}
      <h2>
        {title} {accent && <em>{accent}</em>}
      </h2>
    </div>
  )
}

export default SectionHead
