import MainLayout from './layouts/MainLayout.js';
import HomePage from './pages/HomePage.js';
import AboutPage from './pages/AboutPage.js';
import type { Resource } from './lib/resource.js';

type AppProps = {
  pathname: string;
  resource: Resource<string>;
};

export default function App({ pathname, resource }: AppProps) {
  if (pathname === '/about') {
    return (
      <MainLayout>
        <AboutPage />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <HomePage resource={resource} />
    </MainLayout>
  );
}
