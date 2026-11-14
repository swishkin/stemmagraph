import { useEffect, useState } from 'react';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Header } from './components/Header/Header';
import { Toolbar } from './components/Toolbar/Toolbar';
import { StatsSidebar } from './components/Sidebar/StatsSidebar';
import { MemberDetailSidebar } from './components/Sidebar/MemberDetailSidebar';
import { FamilyTreeView } from './components/FamilyTree/FamilyTreeView';
import { BottomNavigation } from './components/BottomNavigation/BottomNavigation';

import { useFamilyStore } from './store/familyStore';
import { useDashboardStore } from './store/dashboardStore';
import { useAuthStore } from './store/authStore';
import { currentRoute, pushRoute } from './utils/routing';

function App() {
  const { selectedMember, fetchMembers } = useFamilyStore();
  const { familyTrees, fetchTrees } = useDashboardStore();
  const { isInitialized, isAuthenticated, initialize } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'family-tree'>('dashboard');
  const [currentFamilyTreeName, setCurrentFamilyTreeName] = useState<string>('');

  // Initialize auth on mount. Trees are fetched by the effect below once
  // auth is settled: at mount there is no token yet in a fresh browser, so
  // an immediate fetch 401s and — with nothing re-fetching after login —
  // the dashboard would stay empty until a manual page reload.
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Fetch trees after auth is resolved: both a restored session and a fresh
  // login flip isAuthenticated, which re-runs this effect and loads the
  // caller's trees into the dashboard.
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      fetchTrees();
    }
  }, [isInitialized, isAuthenticated, fetchTrees]);

  useEffect(() => {
    // Wait for trees to load before determining view
    if (!isInitialized) return;

    const route = currentRoute();

    if (route.startsWith('/family-tree/')) {
      const treeId = route.split('/family-tree/')[1];
      const familyTree = familyTrees.find(tree => tree.id === treeId);

      if (!familyTree) {
        pushRoute('/dashboard');
        setCurrentView('dashboard');
        return;
      }

      setCurrentFamilyTreeName(familyTree.name);
      setCurrentView('family-tree');

      // Load members from adapter
      fetchMembers(treeId);
    } else {
      setCurrentView('dashboard');
    }
  }, [isInitialized, fetchMembers, familyTrees]);

  const handleMenuToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const route = currentRoute();
      if (route.startsWith('/family-tree/')) {
        const treeId = route.split('/family-tree/')[1];
        const familyTree = familyTrees.find(tree => tree.id === treeId);

        if (!familyTree) {
          setCurrentView('dashboard');
          return;
        }

        setCurrentFamilyTreeName(familyTree.name);
        setCurrentView('family-tree');
        fetchMembers(treeId);
      } else {
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fetchMembers, familyTrees]);

  return (
    <ProtectedRoute>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'family-tree' && (
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
          <Header onMenuToggle={handleMenuToggle} familyName={currentFamilyTreeName} />

          <Toolbar
            onBackToDashboard={() => {
              pushRoute('/dashboard');
              setCurrentView('dashboard');
            }}
          />

          <div className="flex flex-1 overflow-hidden">
            <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block`}>
              <StatsSidebar />
            </div>

            <div className="flex-1 flex flex-col">
              <FamilyTreeView />
            </div>

            {selectedMember && <MemberDetailSidebar />}
          </div>

          <BottomNavigation />
        </div>
      )}
    </ProtectedRoute>
  );
}

export default App;