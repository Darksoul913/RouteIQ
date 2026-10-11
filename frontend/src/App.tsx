import { StoreProvider, useHashRoute } from './store';
import Home from './pages/Home';
import Shell from './pages/Shell';
import LiveRouting from './pages/LiveRouting';
import Fleet from './pages/Fleet';
import Traces from './pages/Traces';
import Policies from './pages/Policies';
import Lab from './pages/Lab';
import Audit from './pages/Audit';
import Keys from './pages/Keys';
import Settings from './pages/Settings';

function Router() {
  const route = useHashRoute();
  const [root, page = 'overview', param] = route.split('/');
  // The overview is the home page; it lives outside the workspace shell.
  const pages = ['live', 'fleet', 'traces', 'policies', 'lab', 'audit', 'keys', 'settings'];
  if (root !== 'app' || !pages.includes(page)) return <Home />;
  const body = (() => {
    switch (page) {
      case 'live': return <LiveRouting />;
      case 'fleet': return <Fleet focus={param} />;
      case 'traces': return <Traces focus={param} />;
      case 'policies': return <Policies />;
      case 'lab': return <Lab />;
      case 'audit': return <Audit />;
      case 'keys': return <Keys />;
      case 'settings': return <Settings />;
      default: return null;
    }
  })();
  return <Shell page={page}>{body}</Shell>;
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
