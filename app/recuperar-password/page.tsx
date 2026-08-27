'use client'

import { useState } from 'react'
import { createClient } from '../../utils/supabase/client'

export default function RecuperarPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function recuperar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMensaje('')

    const origin = window.location.origin

    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${origin}/cambiar-password`,
        }
      )

    if (resetError) {
      setError(
        'No se pudo enviar el correo de recuperación. Intentá nuevamente.'
      )
      setLoading(false)
      return
    }

    /*
     * No revelamos si el correo existe o no.
     */
    setMensaje(
      'Si el correo corresponde a un usuario registrado, recibirás un enlace para crear una nueva contraseña.'
    )
    setLoading(false)
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
          Recuperar contraseña
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          Ingresá tu correo y te enviaremos un enlace para establecer una nueva contraseña.
        </p>

        <form onSubmit={recuperar} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Correo electrónico
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 placeholder:text-gray-400"
              placeholder="usuario@empresa.com"
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
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <a
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    </main>
  )
}
