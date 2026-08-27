'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'
import { finalizarCambioPassword } from './actions'

export default function CambiarPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    let activo = true

    async function verificarSesion() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!activo) return

      if (!user) {
        setError(
          'El enlace no es válido, expiró o no hay una sesión activa. Solicitá nuevamente la recuperación de contraseña.'
        )
      }

      setVerificando(false)
    }

    verificarSesion()

    return () => {
      activo = false
    }
  }, [supabase])

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (password.length < 6) {
      setError(
        'La nueva contraseña debe tener al menos 6 caracteres.'
      )
      return
    }

    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError(
        'La sesión no es válida. Solicitá nuevamente la recuperación de contraseña.'
      )
      setLoading(false)
      return
    }

    const { error: passwordError } =
      await supabase.auth.updateUser({
        password,
      })

    if (passwordError) {
      setError(
        'No se pudo actualizar la contraseña. Intentá nuevamente.'
      )
      setLoading(false)
      return
    }

    /*
     * Limpiamos la marca con una Server Action usando el cliente
     * administrativo. Así no dependemos de las políticas RLS
     * del navegador y solo se modifica el perfil del usuario autenticado.
     */
    const resultadoPerfil =
      await finalizarCambioPassword()

    if (!resultadoPerfil.ok) {
      setError(
        'La contraseña fue actualizada, pero no se pudo completar el estado del perfil. Contactá al administrador.'
      )
      setLoading(false)
      return
    }

    setMensaje('Contraseña actualizada correctamente.')

    setTimeout(() => {
      router.push('/cotizador')
      router.refresh()
    }, 800)
  }

  if (verificando) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-gray-500">
          Verificando sesión...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-red-600">
            Claro
          </h1>

          <p className="text-gray-500 mt-1">
            Cotizador Comercial
          </p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Cambiar contraseña
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          Elegí una nueva contraseña para tu cuenta.
        </p>

        <form onSubmit={cambiarPassword} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nueva contraseña
            </label>

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repetir nueva contraseña
            </label>

            <input
              type="password"
              required
              minLength={6}
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!error && !password}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Actualizando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </main>
  )
}
