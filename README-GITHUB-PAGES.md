# Campus Desk on GitHub Pages

This version includes a GitHub Actions workflow that builds the Vite project and publishes the `dist` directory.

## Publish it

1. Create a GitHub repository named `Campus-Desk` (or another name).
2. Upload the **contents** of this folder to the repository root, keeping `.github/workflows/deploy.yml` in place. Do not upload the ZIP as the only file.
3. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
4. Open **Actions** and wait for **Deploy Campus Desk to GitHub Pages** to finish successfully.
5. Open the URL shown by the deployment. For a repository named `Campus-Desk`, it is usually `https://YOUR-USERNAME.github.io/Campus-Desk/`.

The existing Vite configuration uses `base: './'`, which supports the repository subpath used by GitHub Pages.

## Data and AI notes

- Planner tasks, theme settings, and the AI key setting are stored in browser `localStorage`, not in a Campus Desk database. Each browser/device has its own copy.
- When you use the AI assistant, your question and relevant planner task details are sent directly from your browser to the AI provider you configure in Settings. The provider may process that information under its own terms.
- Never put an API key in the source files or commit it to GitHub. Enter your own key only in the site's Settings. The key remains in that browser's local storage.
- GitHub Pages does not run the `backend/` server. The AI assistant in this build calls the provider directly; it will work only if that provider allows browser requests from your site's origin (CORS). If requests are blocked by the provider, the dashboard, planner, study links, and other local tools still work, but AI chat needs a separate backend.
