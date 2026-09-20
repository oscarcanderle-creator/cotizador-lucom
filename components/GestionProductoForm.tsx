'use client'

import { ReactNode, useActionState, useEffect, useRef } from 'react'

export type GestionProductoFormState = {
  error: string | null
  campo?: string | null
}

type Props = {
  action: (
    estadoAnterior: GestionProductoFormState,
    formData: FormData
  ) => Promise<GestionProductoFormState>
  formKey: string
  className?: string
  children: ReactNode
}

const ESTADO_INICIAL: GestionProductoFormState = {
  error: null,
  campo: null,
}

export default function GestionProductoForm({
  action,
  formKey,
  className,
  children,
}: Props) {
  const [estado, formAction] = useActionState(action, ESTADO_INICIAL)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!estado.error || !estado.campo) return

    const campo = formRef.current?.elements.namedItem(estado.campo)

    if (campo instanceof HTMLInputElement) {
      campo.focus()
      campo.setCustomValidity(estado.error)
      campo.reportValidity()
    }
  }, [estado])

  return (
    <form
      key={formKey}
      ref={formRef}
      action={formAction}
      className={className}
      onInput={(event) => {
        const elemento = event.target
        if (elemento instanceof HTMLInputElement) {
          elemento.setCustomValidity('')
        }
      }}
    >
      {estado.error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {estado.error}
        </div>
      )}

      {children}
    </form>
  )
}
