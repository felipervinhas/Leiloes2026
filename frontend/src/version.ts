import pacote from '../package.json';

// `versao` é o número que o time controla manualmente (bump em package.json
// a cada release: 1.0.0 -> 1.1.0 -> ...) — é o que aparece no footer do
// sistema. `commit`/`dataBuild` vêm do amplify.yml (git rev-parse + data do
// build) e continuam disponíveis pra depuração fina; em dev local (`npm
// start`) essas env vars não existem, daí o fallback 'dev'.
export const VERSAO_FRONTEND = {
  versao: pacote.version,
  commit: process.env.REACT_APP_COMMIT_SHA || 'dev',
  dataBuild: process.env.REACT_APP_BUILD_DATE,
};
