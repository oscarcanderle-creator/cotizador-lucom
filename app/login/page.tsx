'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const {
      data,
      error: loginError,
    } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (loginError || !data.user) {
      setError('Usuario o contraseña incorrectos.')
      setLoading(false)
      return
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('activo, debe_cambiar_password')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      setError('No se pudo verificar el perfil del usuario.')
      setLoading(false)
      return
    }

    if (!profile.activo) {
      await supabase.auth.signOut()
      setError('El usuario se encuentra inactivo. Contacte al administrador.')
      setLoading(false)
      return
    }

    if (profile.debe_cambiar_password) {
      router.push('/cambiar-password')
      router.refresh()
      return
    }

    router.push('/cotizador')
    router.refresh()
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

        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Iniciar sesión
        </h2>

        <form onSubmit={iniciarSesion} className="space-y-5">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <a
            href="/recuperar-password"
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
      </div>
    </main>
  )
}
