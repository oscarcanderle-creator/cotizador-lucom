'use client'

type Props = {
  name: string
  defaultValue?: string | number | null
  tipo: 'SDS' | 'OT' | 'SIM'
  className?: string
  placeholder?: string
}

export default function GestionInputValidado({
  name,
  defaultValue,
  tipo,
  className,
  placeholder,
}: Props) {
  const configurar = () => {
    if (tipo === 'SDS') {
      return {
        maxLength: 11,
        pattern: '[0-9]{8}[A-Za-z]{3}',
        title: 'Debe contener exactamente 8 números y 3 letras.',
        normalizar: (valor: string) => {
          const limpio = valor.toUpperCase().replace(/[^0-9A-Z]/g, '')
          let salida = ''
          for (const c of limpio) {
            if (salida.length < 8) {
              if (/[0-9]/.test(c)) salida += c
            } else if (salida.length < 11 && /[A-Z]/.test(c)) {
              salida += c
            }
          }
          return salida
        },
      }
    }

    const cantidad = tipo === 'OT' ? 8 : 19
    return {
      maxLength: cantidad,
      pattern: `[0-9]{${cantidad}}`,
      title: `Debe contener exactamente ${cantidad} dígitos.`,
      normalizar: (valor: string) => valor.replace(/\D/g, '').slice(0, cantidad),
    }
  }

  const cfg = configurar()

  return (
    <input
      type="text"
      name={name}
      inputMode={tipo === 'SDS' ? 'text' : 'numeric'}
      defaultValue={defaultValue ?? ''}
      maxLength={cfg.maxLength}
      pattern={cfg.pattern}
      title={cfg.title}
      placeholder={placeholder}
      onInput={(e) => {
        e.currentTarget.value = cfg.normalizar(e.currentTarget.value)
      }}
      className={className}
    />
  )
}
