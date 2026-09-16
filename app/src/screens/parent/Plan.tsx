import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCloud } from '../../lib/useCloud';
import { Bar, TopBar, useToast } from '../../components/ui';
import { IconCheck } from '../../components/Icons';
import { fetchPlans, startCheckout, type PlanOption } from '../../lib/cloud';
import { SUPPORT_EMAIL } from '../../lib/config';

/** Formats pence/cents in the currency the operator prices in. */
function money(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

const PERIOD_SUFFIX: Record<string, string> = {
  month: '/month',
  year: '/year',
  once: ' once',
};

export default function PlanScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { cloud, account, refreshAccount } = useCloud();
  const toast = useToast();

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud) return;
    void fetchPlans(cloud.serverUrl)
      .then((result) => {
        setPlans(result.plans);
        setCheckoutAvailable(result.checkoutAvailable);
      })
      .catch(() => undefined);
  }, [cloud]);

  // Coming back from a hosted checkout, the entitlement has usually just changed.
  useEffect(() => {
    const outcome = params.get('checkout');
    if (outcome === 'success') {
      toast('Thank you — your plan is active.');
      void refreshAccount();
    } else if (outcome === 'cancelled') {
      toast('No charge made.');
    }
  }, [params, refreshAccount, toast]);

  if (!cloud || !account) {
    return (
      <div className="screen">
        <TopBar title="Your plan" onBack={() => navigate('/p/settings')} />
        <div className="card">
          <h3>Sign in first</h3>
          <p className="soft" style={{ marginTop: 6 }}>
            Plans belong to your Nightshift account.
          </p>
          <button className="btn btn--block" style={{ marginTop: 12 }} onClick={() => navigate('/p/account')}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const ent = account.entitlement;
  const isTrial = ent.plan === 'trial';
  const trouble = ent.status !== 'active';

  const upgrade = async (plan: string) => {
    setBusy(plan);
    try {
      const url = await startCheckout(cloud, plan);
      // Hosted checkout: leaving the app is expected and comes straight back.
      window.location.href = url;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start checkout.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Your plan" onBack={() => navigate('/p/settings')} />

      <div
        className="card"
        style={{ borderColor: trouble ? 'var(--warn)' : 'var(--line)' }}
      >
        <div className="card__head">
          <div className="avatar" aria-hidden>{trouble ? '⚠️' : '✅'}</div>
          <div style={{ flex: 1 }}>
            <h3>{ent.planLabel}</h3>
            <p className="muted">{ent.blurb}</p>
          </div>
        </div>

        {trouble ? (
          <p className="soft" style={{ color: 'var(--warn)' }}>
            {ent.status === 'expired'
              ? 'Your trial has ended. Pick a plan below to keep going.'
              : ent.status === 'past_due'
                ? 'The last payment did not go through.'
                : 'This subscription was cancelled.'}
          </p>
        ) : (
          <p className="muted">
            {isTrial ? 'Trial ends' : 'Renews'} {new Date(ent.renewsAt).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="section-label">What you have used</div>
      <div className="card stack">
        <div>
          <Bar
            value={ent.stories.limit ? ent.stories.used / ent.stories.limit : 0}
            label="Stories"
          />
          <p className="muted" style={{ marginTop: 4 }}>
            {ent.stories.used} of {ent.stories.limit} this period
          </p>
        </div>
        <div>
          <Bar
            value={ent.narration.limit ? ent.narration.used / ent.narration.limit : 0}
            label="Narration in your voice"
          />
          <p className="muted" style={{ marginTop: 4 }}>
            About {Math.round((ent.narration.limit - ent.narration.used) / 3600)} more stories' worth
          </p>
        </div>
        <div>
          <Bar value={ent.voices.limit ? ent.voices.used / ent.voices.limit : 0} label="Voices" />
          <p className="muted" style={{ marginTop: 4 }}>
            {ent.voices.used} of {ent.voices.limit} grown-ups set up
          </p>
        </div>
      </div>

      {!account.capabilities.voiceCloning && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <h3>Voice building is offline</h3>
          <p className="soft" style={{ marginTop: 6 }}>
            Stories still send and still get read aloud — just not in your voice until this is back.
            Nothing is being charged against your plan while it is down.
          </p>
        </div>
      )}

      {plans.length > 0 && (
        <>
          <div className="section-label">{isTrial || trouble ? 'Choose a plan' : 'Change plan'}</div>
          <div className="stack">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="card"
                style={{ marginTop: 0, borderColor: plan.id === ent.plan ? 'var(--accent)' : 'var(--line)' }}
              >
                <div className="card__head">
                  <div style={{ flex: 1 }}>
                    <h3>{plan.label}</h3>
                    <p className="muted">{plan.blurb}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
                      {money(plan.price)}
                    </div>
                    <div className="muted">{PERIOD_SUFFIX[plan.period] ?? ''}</div>
                  </div>
                </div>

                {plan.id === ent.plan ? (
                  <span className="badge badge--good">
                    <IconCheck size={14} /> Current plan
                  </span>
                ) : (
                  <button
                    className="btn btn--block btn--sm"
                    disabled={!plan.available || !checkoutAvailable || busy === plan.id}
                    onClick={() => upgrade(plan.id)}
                  >
                    {busy === plan.id ? 'Opening checkout…' : `Choose ${plan.label}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!checkoutAvailable && (
        <div className="card">
          <h3>Payments are not switched on yet</h3>
          <p className="soft" style={{ marginTop: 6 }}>
            Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will set your plan
            up by hand.
          </p>
        </div>
      )}

      <p className="muted" style={{ textAlign: 'center', marginTop: 18 }}>
        Cancel any time. Stories you have already been sent stay yours forever, plan or no plan.
      </p>
    </div>
  );
}
