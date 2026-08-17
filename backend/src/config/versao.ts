import { execSync } from 'child_process';
import pacote from '../../package.json';

function git(comando: string): string | undefined {
  try {
    return execSync(comando, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

// `versao` é o número que o time controla manualmente (bump em package.json
// a cada release: 1.0.0 -> 1.1.0 -> ...). `commit`/`dataCommit` continuam
// disponíveis pra depuração fina, mas o footer do sistema mostra a versão.
// Calculado uma vez, na subida do processo — reflete o commit que está
// rodando desde o último `git pull` + restart do PM2, não o HEAD atual do
// working tree (que pode já ter mudado se alguém commitou depois do deploy).
export const VERSAO = {
  versao: pacote.version,
  commit: git('git rev-parse --short HEAD') || 'desconhecido',
  dataCommit: git('git log -1 --format=%cI'),
  dataInicializacao: new Date().toISOString(),
};
