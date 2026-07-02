'use client'

export default function LogoImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-10 mx-auto mb-2 object-contain"
      onError={e => { e.currentTarget.style.display = 'none' }}
    />
  )
}
