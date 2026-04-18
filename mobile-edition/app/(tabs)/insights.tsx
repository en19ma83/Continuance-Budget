import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, useColorScheme, Linking } from 'react-native';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useEdition } from '../../contexts/EditionContext';
import { Sparkles, MessageSquare, Landmark, FileText, Users, ArrowRight } from 'lucide-react-native';

// ─── Pro gate teaser ────────────────────────────────────────────────────────

const PRO_FEATURES = [
  {
    icon: Sparkles,
    color: '#f59e0b',
    title: 'AI Insights',
    desc: 'Spending trends, anomaly alerts, and a monthly narrative written by AI.',
  },
  {
    icon: MessageSquare,
    color: '#60a5fa',
    title: 'AI Chat',
    desc: '"What did I spend on food in March?" — ask anything about your finances.',
  },
  {
    icon: Landmark,
    color: '#34d399',
    title: 'Live Bank Feed',
    desc: 'Connect your bank via Open Banking. Transactions auto-categorise in real time.',
  },
  {
    icon: FileText,
    color: '#a78bfa',
    title: 'Tax Export',
    desc: 'AI-generated category summaries exported as PDF for your accountant.',
  },
  {
    icon: Users,
    color: '#f87171',
    title: 'Family & Business Teams',
    desc: 'Multiple seats, shared budgets, per-user permission levels.',
  },
];

function ProGate() {
  const isDark = useColorScheme() === 'dark';

  return (
    <ScrollView
      className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'}`}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Hero */}
      <View className="px-5 pt-14 pb-6">
        <View className="flex-row items-center gap-2 mb-3">
          <Sparkles size={22} color="#f59e0b" />
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Continuance Pro
          </Text>
        </View>
        <Text className={`text-base leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Your backend is running the Community Edition. Upgrade to Pro for AI-powered insights,
          live bank feeds, and a fully managed backend — no Docker required.
        </Text>
      </View>

      {/* Feature list */}
      <View className="px-4 gap-3 mb-8">
        {PRO_FEATURES.map((f) => (
          <View
            key={f.title}
            className={`flex-row items-start p-4 rounded-2xl gap-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
          >
            <View
              className="w-10 h-10 rounded-xl items-center justify-center mt-0.5"
              style={{ backgroundColor: f.color + '22' }}
            >
              <f.icon size={18} color={f.color} />
            </View>
            <View className="flex-1">
              <Text className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {f.title}
              </Text>
              <Text className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {f.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View className="px-4">
        <TouchableOpacity
          className="bg-amber-500 rounded-2xl py-4 flex-row items-center justify-center gap-2"
          activeOpacity={0.85}
          onPress={() => Linking.openURL('https://github.com/en19ma83/Continuance-Budget')}
        >
          <Sparkles size={18} color="white" />
          <Text className="text-white font-semibold text-base">Learn about Pro</Text>
          <ArrowRight size={16} color="white" />
        </TouchableOpacity>

        <Text className={`text-center text-xs mt-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          A$12/mo · A$99/yr · Cancel any time
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Pro screens (shown when Pro backend detected) ──────────────────────────

function InsightsPlaceholder({ isDark }: { isDark: boolean }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Sparkles size={40} color="#f59e0b" />
      <Text className={`text-lg font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
        AI Insights
      </Text>
      <Text className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Spending trends, anomaly alerts and your monthly financial narrative will appear here.
      </Text>
    </View>
  );
}

function ChatPlaceholder({ isDark }: { isDark: boolean }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <MessageSquare size={40} color="#60a5fa" />
      <Text className={`text-lg font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
        AI Chat
      </Text>
      <Text className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Ask anything about your finances — "What did I spend on food in March?"
      </Text>
    </View>
  );
}

function BankFeedPlaceholder({ isDark }: { isDark: boolean }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Landmark size={40} color="#34d399" />
      <Text className={`text-lg font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Bank Feed
      </Text>
      <Text className={`text-sm text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Live bank connection via Open Banking / CDR. New transactions auto-categorise.
      </Text>
    </View>
  );
}

// ─── Pro dashboard ───────────────────────────────────────────────────────────

type ProTab = 'insights' | 'chat' | 'bank';

function ProDashboard() {
  const isDark = useColorScheme() === 'dark';
  const { version } = useEdition();
  const { hasAiInsights, hasAiChat, hasBankFeed } = useFeatureFlags();

  const allTabs: { key: ProTab; label: string; icon: typeof Sparkles; enabled: boolean }[] = [
    { key: 'insights', label: 'Insights', icon: Sparkles, enabled: hasAiInsights },
    { key: 'chat', label: 'Chat', icon: MessageSquare, enabled: hasAiChat },
    { key: 'bank', label: 'Bank Feed', icon: Landmark, enabled: hasBankFeed },
  ];
  const tabs = allTabs.filter((t) => t.enabled);

  const [activeTab, setActiveTab] = useState<ProTab>(tabs[0]?.key ?? 'insights');

  return (
    <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Header */}
      <View className="px-5 pt-14 pb-3 flex-row items-center gap-2">
        <Sparkles size={20} color="#f59e0b" />
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Pro Insights
        </Text>
        <View className="ml-auto bg-amber-500 px-2 py-0.5 rounded-full">
          <Text className="text-white text-xs font-semibold">PRO</Text>
        </View>
      </View>

      {/* Sub-tabs */}
      {tabs.length > 1 && (
        <View className={`flex-row mx-4 mb-4 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              className={`flex-1 py-2 rounded-lg items-center ${activeTab === t.key ? 'bg-amber-500' : ''}`}
              onPress={() => setActiveTab(t.key)}
            >
              <Text className={`text-xs font-medium ${activeTab === t.key ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      {activeTab === 'insights' && <InsightsPlaceholder isDark={isDark} />}
      {activeTab === 'chat' && <ChatPlaceholder isDark={isDark} />}
      {activeTab === 'bank' && <BankFeedPlaceholder isDark={isDark} />}

      <Text className={`text-center text-xs pb-6 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
        Pro backend {version}
      </Text>
    </View>
  );
}

// ─── Screen entry point ──────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { isPro } = useFeatureFlags();
  return isPro ? <ProDashboard /> : <ProGate />;
}
