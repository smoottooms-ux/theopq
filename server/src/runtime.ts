import type { Express, NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import type { Database } from 'better-sqlite3';

/**
 * The things a server needs to survive contact with the internet.
 *
 * None of this is interesting, and all of it is the difference between a
 * process that runs on a laptop and one you can leave alone on a box for a
 * year: correct client IPs behind a proxy, a log line per request, a
 * readiness probe an orchestrator can poll, and a shutdown that finishes
 * in-flight work instead of dropping it.
 */

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/* ---------------- startup checks ---------------- */

export interface StartupWarning {
  level: 'fatal' | 'warn' | 'info';
  message: string;
}

/**
 * Inspects the environment and says plainly what is wrong.
 *
 * Fatal problems stop the process in production rather than letting it serve
 * traffic in a state the operator did not intend; in development they are
 * warnings so the thing still boots.
 */
export function inspectEnvironment(): StartupWarning[] {
  const out: StartupWarning[] = [];
  const has = (key: string) => !!process.env[key]?.trim();

  if (!has('ELEVENLABS_API_KEY')) {
    out.push({
      level: 'warn',
      message:
        'ELEVENLABS_API_KEY is not set. Stories will still send and be read by the child\'s device, but nobody gets a cloned voice.',
    });
  }
  if (!has('ANTHROPIC_API_KEY')) {
    out.push({
      level: 'info',
      message:
        'ANTHROPIC_API_KEY is not set. The app\'s built-in story engine will be used instead of bespoke writing.',
    });
  }
  if (!has('ADMIN_TOKEN')) {
    out.push({
      level: 'warn',
      message:
        'ADMIN_TOKEN is not set, so /admin/plan is disabled. Without it you cannot grant or cancel a plan by hand.',
    });
  }

  const cors = process.env.CORS_ORIGIN ?? '*';
  if (IS_PRODUCTION && cors === '*') {
    out.push({
      level: 'warn',
      message: 'CORS_ORIGIN is "*" in production. Set it to your app\'s origin.',
    });
  }

  if (has('STRIPE_SECRET_KEY') && !has('STRIPE_WEBHOOK_SECRET')) {
    out.push({
      level: 'fatal',
      message:
        'STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is not. Checkout would take money and the server would never hear that it succeeded.',
    });
  }
  if (has('STRIPE_SECRET_KEY') && !has('APP_URL')) {
    out.push({
      level: 'fatal',
      message: 'STRIPE_SECRET_KEY is set but APP_URL is not, so checkout has nowhere to return to.',
    });
  }
  if (has('STRIPE_SECRET_KEY') && !has('STRIPE_PRICE_FAMILY')) {
    out.push({
      level: 'warn',
      message: 'Stripe is configured but no STRIPE_PRICE_* ids are set, so nothing is purchasable.',
    });
  }
  if (IS_PRODUCTION && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    out.push({ level: 'warn', message: 'Running in production with a Stripe TEST key.' });
  }

  return out;
}

/** Prints the startup report and exits on a fatal problem in production. */
export function reportEnvironment(warnings: StartupWarning[]): void {
  const symbol = { fatal: '✗', warn: '!', info: '·' } as const;
  for (const warning of warnings) {
    const line = `[startup] ${symbol[warning.level]} ${warning.message}`;
    if (warning.level === 'fatal') console.error(line);
    else console.warn(line);
  }

  if (IS_PRODUCTION && warnings.some((w) => w.level === 'fatal')) {
    console.error('[startup] Refusing to start with a misconfiguration this serious.');
    process.exit(1);
  }
}

/* ---------------- middleware ---------------- */

/** One structured line per request. Slow and failed requests stand out. */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      // Audio streams are noisy and uninteresting when they succeed.
      const boring = res.statusCode < 400 && req.path.endsWith('/audio');
      if (boring) return;

      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      const line = JSON.stringify({
        t: new Date().toISOString(),
        level,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(ms),
        ip: req.ip,
      });
      if (level === 'error') console.error(line);
      else console.log(line);
    });

    next();
  };
}

/**
 * Conservative security headers.
 *
 * The API serves JSON and audio to a native WebView and a PWA, never HTML, so
 * a strict policy costs nothing here.
 */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), payment=()');
    if (IS_PRODUCTION) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

/** Correct client IPs when sitting behind nginx, Caddy, Fly or a load balancer. */
export function configureProxyTrust(app: Express): void {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? (IS_PRODUCTION ? 1 : 0));
  if (hops > 0) app.set('trust proxy', hops);
}

/* ---------------- lifecycle ---------------- */

/**
 * Stops accepting connections, lets in-flight requests finish, then closes the
 * database so SQLite's WAL is checkpointed cleanly.
 */
export function installGracefulShutdown(server: Server, db: Database): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received, draining…`);

    const forced = setTimeout(() => {
      console.error('[shutdown] Timed out waiting for connections. Exiting anyway.');
      process.exit(1);
    }, 15_000);
    forced.unref();

    server.close((err) => {
      if (err) console.error('[shutdown] Error closing server:', err);
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
        console.log('[shutdown] Database closed cleanly.');
      } catch (dbErr) {
        console.error('[shutdown] Error closing database:', dbErr);
      }
      clearTimeout(forced);
      process.exit(err ? 1 : 0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // An unhandled rejection is a bug, but it should not take bedtime down.
  process.on('unhandledRejection', (reason) => {
    console.error('[error] Unhandled rejection:', reason);
  });
}
