"use client"

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function GoogleSuccessPage() {
  const [isProcessing, setIsProcessing] = useState(true)
  const { setUserDirectly } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const handleGoogleSuccess = async () => {
      // Đọc tham số từ URL một lần, tránh phụ thuộc searchParams
      const params = new URLSearchParams(window.location.search)
      const access_token = params.get('access_token')
      const userId = params.get('user_id')
      const userName = params.get('user_name')
      const userEmail = params.get('user_email')
      const userAvatar = params.get('user_avatar')

      if (!access_token) {
        toast({
          title: "Error",
          description: "No access token received from Google login",
          variant: "destructive",
        })
        router.push('/auth/login')
        return
      }

      try {
        localStorage.setItem('access_token', access_token)

        const user = {
          _id: userId || '',
          email: userEmail || '',
          name: userName ? decodeURIComponent(userName).replace(/\+/g, ' ') : '',
          avatar: userAvatar || '',
        }

        setUserDirectly(user)

        try {
          const { apiClient } = await import('@/lib/api')
          const userResponse = await apiClient.getCurrentUser()
          if (userResponse.statusCode === 200 && userResponse.data) {
            setUserDirectly(userResponse.data)
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error)
        }

        toast({
          title: "Success",
          description: "Logged in with Google successfully",
        })

        router.push('/')
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Google login failed",
          variant: "destructive",
        })
        router.push('/auth/login')
      } finally {
        setIsProcessing(false)
      }
    }

    handleGoogleSuccess()
  }, [router, toast, setUserDirectly]) // hoặc để [] nếu linter không bắt buộc

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Processing Google Login</CardTitle>
            <CardDescription className="text-center">
              Please wait while we complete your Google login...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {isProcessing && (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}