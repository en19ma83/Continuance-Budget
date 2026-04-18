import { useEdition } from '../contexts/EditionContext';

export interface FeatureFlags {
  isPro: boolean;
  isCommunity: boolean;

  // Community features (always on)
  hasLedger: boolean;
  hasRules: boolean;
  hasAssets: boolean;
  hasAccounts: boolean;
  hasReconciliation: boolean;
  hasPushNotifications: boolean;

  // Pro-only features
  hasAiInsights: boolean;
  hasAiChat: boolean;
  hasBankFeed: boolean;
  hasTaxExport: boolean;
  hasTeam: boolean;
}

export function useFeatureFlags(): FeatureFlags {
  const { edition, features } = useEdition();
  const isPro = edition === 'pro';
  const has = (f: string) => features.includes(f);

  return {
    isPro,
    isCommunity: edition === 'community' || edition === 'unknown',

    hasLedger: true,
    hasRules: true,
    hasAssets: true,
    hasAccounts: true,
    hasReconciliation: has('reconciliation'),
    hasPushNotifications: has('push_notifications'),

    // Pro gates — available when backend declares them
    hasAiInsights: isPro && has('insights'),
    hasAiChat: isPro && has('chat'),
    hasBankFeed: isPro && has('bank_feed'),
    hasTaxExport: isPro && has('tax_export'),
    hasTeam: isPro && has('team'),
  };
}
