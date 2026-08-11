import React, { createContext, useContext, useEffect, useState } from "react";
import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from "./api-client";

export type User = {
  id: string;
  email: string;
  username: string;
  created_at: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      apiRequest<User>("/auth/me")
        .then((u) => setUser(u))
        .catch(() => clearAuthToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username_or_email: string, password: string) {
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username_or_email, password }),
    });
    setAuthToken(res.access_token);
    setUser(res.user);
  }

  async function signup(email: string, username: string, password: string) {
    const res = await apiRequest<{ access_token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    });
    setAuthToken(res.access_token);
    setUser(res.user);
  }

  function logout() {
    clearAuthToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
