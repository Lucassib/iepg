import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/Home'
import { AnalyzePage } from './pages/Analyze'
import { TreesD6Page, TreesD7Page, TreesLargePage, TreesSmallPage } from './pages/Trees'
import { LabDiagonalizePage, LabLatentPage } from './pages/Lab'
import { QuestionsPage } from './pages/Questions'
import { AboutPage, NotFoundPage } from './pages/About'
import { Loading } from './components/ErrorNote'

// The larger pages are split into their own chunks.
const PlaygroundPage = lazy(() => import('./pages/Playground').then((m) => ({ default: m.PlaygroundPage })))
const SeedsSdPage = lazy(() => import('./pages/SeedsSd').then((m) => ({ default: m.SeedsSdPage })))
const ThresholdPage = lazy(() => import('./pages/Threshold').then((m) => ({ default: m.ThresholdPage })))
const CographsPage = lazy(() => import('./pages/Cographs').then((m) => ({ default: m.CographsPage })))
const UnicyclicPage = lazy(() => import('./pages/Unicyclic').then((m) => ({ default: m.UnicyclicPage })))
const AdmissibilityPage = lazy(() => import('./pages/Admissibility').then((m) => ({ default: m.AdmissibilityPage })))
const BuildSdPage = lazy(() => import('./pages/BuildSd').then((m) => ({ default: m.BuildSdPage })))
const TowersPage = lazy(() => import('./pages/Towers').then((m) => ({ default: m.TowersPage })))
const HistoryPage = lazy(() => import('./pages/History').then((m) => ({ default: m.HistoryPage })))
const AlgorithmsPage = lazy(() => import('./pages/Algorithms').then((m) => ({ default: m.AlgorithmsPage })))

export default function App() {
  const location = useLocation()
  return (
    <AppShell>
      <PageBoundary resetKey={location.pathname}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/draw" element={<Navigate to="/analyze" replace />} />
          <Route path="/tree/:canonical" element={<AnalyzePage />} />
          <Route path="/trees" element={<Navigate to="/trees/small" replace />} />
          <Route path="/trees/small" element={<TreesSmallPage />} />
          <Route path="/trees/d6" element={<TreesD6Page />} />
          <Route path="/trees/d7" element={<TreesD7Page />} />
          <Route path="/trees/large" element={<TreesLargePage />} />
          <Route path="/seeds/sd" element={<SeedsSdPage />} />
          <Route path="/rooted-seeds" element={<Navigate to="/trees/d6#rooted-seeds" replace />} />
          <Route path="/classes" element={<Navigate to="/classes/threshold" replace />} />
          <Route path="/classes/threshold" element={<ThresholdPage />} />
          <Route path="/classes/cographs" element={<CographsPage />} />
          <Route path="/classes/unicyclic" element={<UnicyclicPage />} />
          <Route path="/lab" element={<Navigate to="/lab/diagonalize" replace />} />
          <Route path="/lab/diagonalize" element={<LabDiagonalizePage />} />
          <Route path="/lab/latent" element={<LabLatentPage />} />
          <Route path="/lab/admissibility" element={<AdmissibilityPage />} />
          <Route path="/lab/build-sd" element={<BuildSdPage />} />
          <Route path="/lab/towers" element={<TowersPage />} />
          <Route path="/algorithms" element={<AlgorithmsPage />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/notation" element={<Navigate to="/" replace />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      </PageBoundary>
    </AppShell>
  )
}

/** A page that fails to load or to render shows a short message instead of an empty screen. */
class PageBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  // a new page clears the message; the pages themselves are not remounted, so /tree/... can hand its tree to /analyze
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="space-y-2 rounded-md border border-dashed border-line bg-surface p-4 font-sans text-sm">
        <p className="font-medium">This page could not be shown.</p>
        <p className="text-muted">The site may have been updated while the page was open.</p>
        <button type="button" className="underline decoration-line underline-offset-2 hover:decoration-ink" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    )
  }
}

