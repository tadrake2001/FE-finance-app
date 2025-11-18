import { ApiResponse, User, Transaction, Account, Budget, Investment, LoginCredentials, RegisterCredentials, AuthResponse, RegisterResponse } from './types'

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || ''
const API_BASE_URL = RAW_BASE ? RAW_BASE.replace(/\/+$/, '') + '/api' : '/api'


class ApiClient {
  private baseURL: string
  private access_token: string | null = null
  private refresh_token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
    if (typeof window !== 'undefined') {
      this.access_token = localStorage.getItem('access_token')
      this.refresh_token = localStorage.getItem('refresh_token')
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.access_token) {
      headers.Authorization = `Bearer ${this.access_token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorText = await response.text()
        
        // If 401 Unauthorized, try to refresh token
        if (response.status === 401 && this.refresh_token && endpoint !== '/auth/refresh') {
          try {
            await this.refreshaccess_token()
            // Retry the original request with new access token
            return this.request(endpoint, options)
          } catch (refreshError) {
            this.clearTokens()
            throw new Error('Authentication failed')
          }
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      return data
    } catch (error) {
      throw error
    }
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    
    if (response.statusCode === 201 && response.data?.access_token) {
      this.access_token = response.data.access_token
      this.refresh_token = response.data.refresh_token || null
      if (typeof window !== 'undefined' && this.access_token) {
        localStorage.setItem('access_token', this.access_token)
        if (this.refresh_token && typeof this.refresh_token === 'string') {
          localStorage.setItem('refresh_token', this.refresh_token)
        }
      }
      
      // Map backend user format to frontend format
      if (response.data.user) {
        response.data.user = {
          _id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.fullName || response.data.user.name || '',
          avatar: response.data.user.avatar || '',
          createdAt: response.data.user.createdAt,
          updatedAt: response.data.user.updatedAt,
        }
      }
    }
    
    return response as ApiResponse<AuthResponse>
  }

  async googleLogin(code: string): Promise<ApiResponse<AuthResponse>> {
    // Note: Backend uses GET /auth/google/callback with OAuth flow
    // This method may need to be adjusted based on actual Google OAuth implementation
    const response = await this.request<any>('/auth/google/callback', {
      method: 'GET',
    })
    
    if (response.statusCode === 201 && response.data?.access_token) {
      this.access_token = response.data.access_token
      this.refresh_token = response.data.refresh_token || null
      if (typeof window !== 'undefined' && this.access_token) {
        localStorage.setItem('access_token', this.access_token)
        if (this.refresh_token && typeof this.refresh_token === 'string') {
          localStorage.setItem('refresh_token', this.refresh_token)
        }
      }
      
      // Map backend user format to frontend format
      if (response.data.user) {
        response.data.user = {
          _id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.fullName || response.data.user.name || '',
          avatar: response.data.user.avatar || '',
          createdAt: response.data.user.createdAt,
          updatedAt: response.data.user.updatedAt,
        }
      }
    }
    
    return response as ApiResponse<AuthResponse>
  }

  async register(credentials: RegisterCredentials): Promise<ApiResponse<RegisterResponse>> {
    // Map frontend format (name) to backend format (fullName)
    const backendCredentials = {
      email: credentials.email,
      password: credentials.password,
      fullName: credentials.name,
      // Don't send confirmPassword to backend
    }
    
    const response = await this.request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(backendCredentials),
    })
    
    // Map backend user format to frontend format if user is returned
    if (response.data?.user) {
      response.data.user = {
        _id: response.data.user.id,
        email: response.data.user.email,
        name: response.data.user.fullName || response.data.user.name || '',
        avatar: response.data.user.avatar || '',
        createdAt: response.data.user.createdAt,
        updatedAt: response.data.user.updatedAt,
      }
    }
    
    return response as ApiResponse<RegisterResponse>
  }

  logout(): void {
    this.clearTokens()
  }

  private clearTokens(): void {
    this.access_token = null
    this.refresh_token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  }

  private async refreshaccess_token(): Promise<void> {
    if (!this.refresh_token) {
      throw new Error('No refresh token available')
    }

    const refresh_token = this.refresh_token as string
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refresh_token }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()

    if (data.statusCode === 200 && data.data?.access_token) {
      this.access_token = data.data.access_token
      if (data.data.refresh_token) {
        this.refresh_token = data.data.refresh_token
      }
      
      if (typeof window !== 'undefined') {
        if (this.access_token) {
          localStorage.setItem('access_token', this.access_token)
        } else {
          localStorage.removeItem('access_token')
        }
        if (this.refresh_token) {
          localStorage.setItem('refresh_token', this.refresh_token)
        } else {
          localStorage.removeItem('refresh_token')
        }
      }
    } else {
      throw new Error('Invalid token refresh response')
    }
  }

  // User
  async getCurrentUser(): Promise<ApiResponse<User>> {
    // Refresh token from localStorage before making request
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('access_token')
      if (storedToken && storedToken !== this.access_token) {
        this.access_token = storedToken
      }
    }
    
    const response = await this.request<any>('/auth/me')
    
    // Map backend user format to frontend format
    if (response.data) {
      response.data = {
        _id: response.data.id,
        email: response.data.email,
        name: response.data.fullName || response.data.name || '',
        avatar: response.data.avatar || '',
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt,
      }
    }
    
    return response as ApiResponse<User>
  }

  async updateUser(userData: Partial<User>): Promise<ApiResponse<User>> {
    // Map frontend format to backend format
    const backendData: any = {
      ...userData,
    }
    if (userData._id) {
      backendData.id = userData._id
      delete backendData._id
    }
    if (userData.name) {
      backendData.fullName = userData.name
      delete backendData.name
    }
    
    const response = await this.request<any>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(backendData),
    })
    
    // Map response back to frontend format
    if (response.data) {
      response.data = {
        _id: response.data.id,
        email: response.data.email,
        name: response.data.fullName || response.data.name || '',
        avatar: response.data.avatar || '',
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt,
      }
    }
    
    return response as ApiResponse<User>
  }

  // Transactions
  async getTransactions(): Promise<ApiResponse<Transaction[]>> {
    return this.request<Transaction[]>('/transactions')
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Transaction>> {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
  }

  async updateTransaction(id: string, transaction: Partial<Transaction>): Promise<ApiResponse<Transaction>> {
    return this.request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    })
  }

  async deleteTransaction(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/transactions/${id}`, {
      method: 'DELETE',
    })
  }

  // Accounts
  async getAccounts(): Promise<ApiResponse<Account[]>> {
    return this.request<Account[]>('/accounts')
  }

  async createAccount(account: Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Account>> {
    return this.request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    })
  }

  async updateAccount(id: string, account: Partial<Account>): Promise<ApiResponse<Account>> {
    return this.request<Account>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(account),
    })
  }

  async deleteAccount(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/accounts/${id}`, {
      method: 'DELETE',
    })
  }

  // Budgets
  async getBudgets(): Promise<ApiResponse<Budget[]>> {
    return this.request<Budget[]>('/budgets')
  }

  async createBudget(budget: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Budget>> {
    return this.request<Budget>('/budgets', {
      method: 'POST',
      body: JSON.stringify(budget),
    })
  }

  async updateBudget(id: string, budget: Partial<Budget>): Promise<ApiResponse<Budget>> {
    return this.request<Budget>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(budget),
    })
  }

  async deleteBudget(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/budgets/${id}`, {
      method: 'DELETE',
    })
  }

  // Investments
  async getInvestments(): Promise<ApiResponse<Investment[]>> {
    return this.request<Investment[]>('/investments')
  }

  async createInvestment(investment: Omit<Investment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Investment>> {
    return this.request<Investment>('/investments', {
      method: 'POST',
      body: JSON.stringify(investment),
    })
  }

  async updateInvestment(id: string, investment: Partial<Investment>): Promise<ApiResponse<Investment>> {
    return this.request<Investment>(`/investments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(investment),
    })
  }

  async deleteInvestment(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/investments/${id}`, {
      method: 'DELETE',
    })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
