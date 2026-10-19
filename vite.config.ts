import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const rootDir = typeof import.meta.dirname !== 'undefined' ? import.meta.dirname : process.cwd();
  return {
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(rootDir, 'index.html'),
          login: path.resolve(rootDir, 'login.html'),
          register: path.resolve(rootDir, 'register.html'),
          donorDashboard: path.resolve(rootDir, 'donor-dashboard.html'),
          seekerDashboard: path.resolve(rootDir, 'seeker-dashboard.html'),
          foodDetails: path.resolve(rootDir, 'food-details.html'),
          requests: path.resolve(rootDir, 'requests.html'),
          profile: path.resolve(rootDir, 'profile.html'),
          history: path.resolve(rootDir, 'history.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
