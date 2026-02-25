import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import TokenPage from './pages/TokenPage';
import CredentialsPage from './pages/CredentialsPage';
import AcademicRewardsPage from './pages/AcademicRewardsPage';
import ExtracurricularPage from './pages/ExtracurricularPage';
import PaymentsPage from './pages/PaymentsPage';
import RecordsPage from './pages/RecordsPage';
import GovernancePage from './pages/GovernancePage';
import StudentIDPage from './pages/StudentIDPage';
import CertificationPage from './pages/CertificationPage';
import ScholarshipPage from './pages/ScholarshipPage';
import AlumniPage from './pages/AlumniPage';
import ReputationPage from './pages/ReputationPage';
import JobBoardPage from './pages/JobBoardPage';
import InternshipPage from './pages/InternshipPage';
import ResearchPage from './pages/ResearchPage';
import AuditingPage from './pages/AuditingPage';
import IntegrationPage from './pages/IntegrationPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import ExchangePage from './pages/ExchangePage';
import DocumentationPage from './pages/DocumentationPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="token" element={<TokenPage />} />
        <Route path="credentials" element={<CredentialsPage />} />
        <Route path="academic-rewards" element={<AcademicRewardsPage />} />
        <Route path="extracurricular" element={<ExtracurricularPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="governance" element={<GovernancePage />} />
        <Route path="student-id" element={<StudentIDPage />} />
        <Route path="certification" element={<CertificationPage />} />
        <Route path="scholarship" element={<ScholarshipPage />} />
        <Route path="alumni" element={<AlumniPage />} />
        <Route path="reputation" element={<ReputationPage />} />
        <Route path="job-board" element={<JobBoardPage />} />
        <Route path="internship" element={<InternshipPage />} />
        <Route path="research" element={<ResearchPage />} />
        <Route path="exchange" element={<ExchangePage />} />
        <Route path="auditing" element={<AuditingPage />} />
        <Route path="integration" element={<IntegrationPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="docs" element={<DocumentationPage />} />
      </Route>
    </Routes>
  );
}
