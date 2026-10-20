// A real deployment is NODE_ENV=production, or any run on a hosting platform that announces itself (Render sets RENDER). Treating Render as
// production even when NODE_ENV was forgotten means the safe settings can never be skipped by mistake.
const HOST_MARKERS = ['RENDER', 'RAILWAY_ENVIRONMENT', 'FLY_APP_NAME', 'DYNO', 'K_SERVICE', 'KOYEB_APP_NAME', 'VERCEL'];
export const isProduction = () => process.env.NODE_ENV === 'production' || HOST_MARKERS.some(name => Boolean(process.env[name]));

// A number setting from the environment, with a default
export const numberSetting = (name, fallback) => (process.env[name] !== undefined && process.env[name] !== '' ? Number(process.env[name]) : fallback);
