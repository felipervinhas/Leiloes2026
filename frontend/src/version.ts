// Preenchido em build-time pelo amplify.yml (git rev-parse + data do build).
// Em dev local (`npm start`) essas env vars não existem — cai no fallback abaixo.
export const VERSAO_FRONTEND = {
  commit: process.env.REACT_APP_COMMIT_SHA || 'dev',
  dataBuild: process.env.REACT_APP_BUILD_DATE,
};
