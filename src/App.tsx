import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAuth } from './components/auth/RouteGuards'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
// import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { TodoDetailPage } from './pages/TodoDetailPage'
import { TodosPage } from './pages/TodosPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Signed-in users are sent on to the app (or back to where they were headed). */}
        <Route element={<PublicOnly />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>

        {/* Reachable either way: reset links arrive by email. */}
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        {/* <Route path="verify-email" element={<VerifyEmailPage />} /> */}
        <Route path="reset-password" element={<ResetPasswordPage />} />

        {/* Everything else needs a session; signed-out visitors go to /login and come back after. */}
        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route element={<Layout />}>
            <Route path="todos" element={<TodosPage />} />
            <Route path="todos/:id" element={<TodoDetailPage />} />
          </Route>
        </Route>

        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
