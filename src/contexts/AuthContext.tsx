"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { User, LoginCredentials, RegisterCredentials, AuthContextType } from '@/lib/types'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Debug: Log user state changes
  useEffect(() => {
    console.log('AuthContext: User state changed:', user)
  }, [user])

  useEffect(() => {
    // Check if user is logged in on mount
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('access_token')
        
        if (token) {
          const response = await apiClient.getCurrentUser()
          
          if (response.statusCode === 200 && response.data) {
            setUser(response.data)
          } else {
            localStorage.removeItem('access_token')
          }
        }
      } catch (error) {
        localStorage.removeItem('access_token')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await apiClient.login(credentials)
      
      // Backend may return 200 or 201 for login
      if ((response.statusCode === 200 || response.statusCode === 201) && response.data?.access_token) {
        // Use user from response if available, otherwise fetch from /auth/me
        if (response.data.user) {
          setUser(response.data.user)
        } else {
          // Get user data using the access token
          const userResponse = await apiClient.getCurrentUser()
          
          if (userResponse.statusCode === 200 && userResponse.data) {
            setUser(userResponse.data)
          } else {
            throw new Error('Failed to get user data after login')
          }
        }
        
        return Promise.resolve()
      } else {
        throw new Error(response.message || 'Login failed')
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  const googleLogin = async (code: string) => {
    try {
      const response = await apiClient.googleLogin(code)
      
      // Backend may return 200 or 201 for login
      if ((response.statusCode === 200 || response.statusCode === 201) && response.data?.access_token) {
        // Use user from response if available, otherwise fetch from /auth/me
        if (response.data.user) {
          setUser(response.data.user)
        } else {
          // Get user data using the access token
          const userResponse = await apiClient.getCurrentUser()
          
          if (userResponse.statusCode === 200 && userResponse.data) {
            setUser(userResponse.data)
          } else {
            throw new Error('Failed to get user data after Google login')
          }
        }
        
        return Promise.resolve()
      } else {
        throw new Error(response.message || 'Google login failed')
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  const register = async (credentials: RegisterCredentials) => {
    try {
      console.log('AuthContext: Starting registration...')
      const response = await apiClient.register(credentials)
      console.log('AuthContext: Registration response:', response)
      
      // Backend may return 200 or 201 for registration
      if (response.statusCode === 200 || response.statusCode === 201) {
        console.log('AuthContext: Registration successful')
        
        // If access_token is returned, use it directly
        if (response.data?.access_token) {
          if (response.data.user) {
            setUser(response.data.user)
            return Promise.resolve()
          }
        }
        
        // Otherwise, auto-login to get tokens
        console.log('AuthContext: Auto-login to get tokens...')
        try {
          const loginResponse = await apiClient.login({
            email: credentials.email,
            password: credentials.password
          })
          
          if ((loginResponse.statusCode === 200 || loginResponse.statusCode === 201) && loginResponse.data?.access_token) {
            // Use user from login response if available
            if (loginResponse.data.user) {
              setUser(loginResponse.data.user)
            } else {
              // Get full user data with tokens
              const userResponse = await apiClient.getCurrentUser()
              
              if (userResponse.statusCode === 200 && userResponse.data) {
                setUser(userResponse.data)
              } else {
                throw new Error('Failed to get user data after registration')
              }
            }
          } else {
            throw new Error('Auto-login failed after registration')
          }
        } catch (loginError) {
          throw new Error('Registration successful but auto-login failed. Please try logging in manually.')
        }
        
        return Promise.resolve()
      } else {
        throw new Error(response.message || 'Registration failed')
      }
    } catch (error) {
      return Promise.reject(error)
    }
  }

  const logout = () => {
    apiClient.logout()
    setUser(null)
  }

  const setUserDirectly = (userData: User) => {
    setUser(userData)
  }

  const value: AuthContextType = {
    user,
    login,
    googleLogin,
    register,
    logout,
    loading,
    setUserDirectly,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
