import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

export default function ProtectedRoute() {
  const { isAuthenticated, verifySession } = useAuth()
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    const verify = async () => {
      await verifySession()
      setIsVerifying(false)
    }
    verify()
  }, [verifySession])

  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
