import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  getSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  setSessionExpiredHandler,
  type AuthenticationUser,
  type FarmerProfile,
  type RegistrationRequest,
  type RegistrationResponse,
} from '../../services/resources/authApi'

type AuthContextValue = {
  user: AuthenticationUser | null
  farmerProfile: FarmerProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (
    usernameOrEmail: string,
    password: string,
  ) => Promise<void>
  register: (
    registrationPayload: RegistrationRequest,
  ) => Promise<RegistrationResponse>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthenticationUser | null>(null)
  const [farmerProfile, setFarmerProfile] =
    useState<FarmerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refreshSession(): Promise<void> {
    try {
      const session = await getSession()
      if (session.is_authenticated) {
        setUser(session.user)
        setFarmerProfile(session.farmer_profile)
      } else {
        setUser(null)
        setFarmerProfile(null)
      }
    } catch {
      setUser(null)
      setFarmerProfile(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setFarmerProfile(null)
      setIsLoading(false)
    })

    return () => setSessionExpiredHandler(null)
  }, [])

  async function login(
    usernameOrEmail: string,
    password: string,
  ): Promise<void> {
    const session = await loginRequest({
      username_or_email: usernameOrEmail,
      password,
    })
    setUser(session.user)
    setFarmerProfile(session.farmer_profile)
  }

  async function register(
    registrationPayload: RegistrationRequest,
  ): Promise<RegistrationResponse> {
    return registerRequest(registrationPayload)
  }

  async function logout(): Promise<void> {
    await logoutRequest()
    setUser(null)
    setFarmerProfile(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      farmerProfile,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
      refreshSession,
    }),
    [user, farmerProfile, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
