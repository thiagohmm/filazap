import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import AtendimentoPage from './pages/AtendimentoPage';
import EquipePage from './pages/EquipePage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/dashboard/atendimento" element={<AtendimentoPage />} />
      <Route path="/dashboard/equipe" element={<EquipePage />} />
      <Route path="/dashboard/configuracoes" element={<ConfiguracoesPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
